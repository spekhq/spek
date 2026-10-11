package com.spek.intellij.server

import io.netty.handler.codec.http.QueryStringDecoder
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** Spec detail and version selection over the shared nested-specs fixture. */
class SpecRoutesTest {

    private val project = File(System.getProperty("spek.nestedSpecsFixture")!!).absolutePath
    private val handler = SpekHttpRequestHandler()

    private fun route(apiPath: String, vararg params: Pair<String, String>) =
        handler.routeRequest(apiPath, project, params.groupBy({ it.first }, { it.second }))

    @Test
    fun `the list returns every nested topic`() {
        val body = assertIs<SpekHttpRequestHandler.ApiResult.Json>(route("openspec/specs")).body
        assertTrue(body.contains("\"topic\":\"contracts/pagination/streaming-search\""), body)
    }

    @Test
    fun `topic selects nested detail and topic plus at selects its version`() {
        val detail = assertIs<SpekHttpRequestHandler.ApiResult.Json>(route("openspec/specs", "topic" to "contracts/pagination"))
        assertTrue(detail.body.contains("\"relatedChanges\":[\"2026-01-10-add-pagination\"]"), detail.body)
        val version = assertIs<SpekHttpRequestHandler.ApiResult.Json>(
            route("openspec/specs", "topic" to "contracts/pagination/streaming-search", "at" to "add-streaming-search"),
        )
        assertTrue(version.body.contains("DELTAONLYTERM"))
    }

    @Test
    fun `malformed selectors are 400`() {
        val cases = listOf(
            listOf("topic" to "../secrets"),
            listOf("topic" to "contracts//pagination"),
            listOf("topic" to "/abs"),
            listOf("topic" to "auth\n"),
            listOf("topic" to ".drafts/hidden"),
            listOf("topic" to "auth", "topic" to "auth"),
            listOf("at" to "add-streaming-search"),
            listOf("topic" to "auth", "at" to "a/b"),
            listOf("topic" to "auth", "at" to ".."),
        )
        for (params in cases) {
            assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(route("openspec/specs", *params.toTypedArray()), params.toString())
        }
    }

    @Test
    fun `well-formed but absent content is 404`() {
        assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(route("openspec/specs", "topic" to "nope"))
        assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(route("openspec/specs", "topic" to "contracts"))
        assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(
            route("openspec/specs", "topic" to "contracts/pagination", "at" to "add-streaming-search"),
        )
    }

    @Test
    fun `the flat routes keep working and apply the same validation`() {
        assertIs<SpekHttpRequestHandler.ApiResult.Json>(route("openspec/specs/auth"))
        assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(route("openspec/specs/auth/at/add-streaming-search"))
        assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(route("openspec/specs/auth/at/.."))
        assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(route("openspec/specs/../../secret"))
    }

    /**
     * The handler matches routes against `QueryStringDecoder.path()`, so whether it decodes `%2F` decides
     * what a single-segment route can receive. It does: an encoded escape reaches the router as `../..`.
     */
    @Test
    fun `QueryStringDecoder path decodes an encoded slash before routing`() {
        val decoder = QueryStringDecoder("/api/spek/openspec/specs/..%2F..%2Fsecret?projectPath=p")
        assertEquals("/api/spek/openspec/specs/../../secret", decoder.path())
        val apiPath = decoder.path().removePrefix("/api/spek/")
        assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(handler.routeRequest(apiPath, project, emptyMap()))
    }
}
