package com.spek.intellij.server

import io.netty.handler.codec.http.DefaultFullHttpRequest
import io.netty.handler.codec.http.HttpMethod
import io.netty.handler.codec.http.HttpVersion
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SpekHttpRequestHandlerTest {

    private fun request(vararg headers: Pair<String, String>): DefaultFullHttpRequest =
        DefaultFullHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.GET, "/api/spek/openspec/changes?projectPath=/x").apply {
            headers.forEach { (name, value) -> headers().set(name, value) }
        }

    /**
     * The platform admits any local Origin regardless of port and echoes it back as
     * Access-Control-Allow-Origin, so refusing the request is the only guard: the plugin's own pages
     * (no Origin, or exactly http://<Host>) pass, everything else is refused.
     */
    @Test
    fun admitsOnlyTheServersOwnOrigin() {
        val handler = SpekHttpRequestHandler()
        val host = "Host" to "localhost:63342"

        assertTrue(handler.isAccessible(request(host)), "no Origin: the webview's own GET")
        assertTrue(handler.isAccessible(request(host, "Origin" to "http://localhost:63342")), "same-origin POST")
        assertTrue(handler.isAccessible(request(host, "Sec-Fetch-Site" to "same-origin")))
        assertTrue(handler.isAccessible(request(host, "Sec-Fetch-Site" to "none")), "external-browser navigation")

        assertFalse(handler.isAccessible(request(host, "Origin" to "http://localhost:8080")), "another local port")
        assertFalse(handler.isAccessible(request(host, "Origin" to "https://evil.example")))
        assertFalse(handler.isAccessible(request(host, "Origin" to "null")))
        assertFalse(handler.isAccessible(request(host, "Sec-Fetch-Site" to "same-site")), "no-cors from another port")
        assertFalse(handler.isAccessible(request(host, "Sec-Fetch-Site" to "cross-site")))
    }

    /** The platform's own Host check still applies underneath: a rebinding host name is refused. */
    @Test
    fun refusesAForeignHost() {
        val handler = SpekHttpRequestHandler()

        assertFalse(handler.isAccessible(request("Host" to "evil.example")))
        assertFalse(handler.isAccessible(request("Host" to "evil.example:63342", "Origin" to "http://evil.example:63342")))
    }

    /**
     * 迴歸測試：這條路由曾經根本不存在，導致三個宿主共用的前端每按一次 Refresh，
     * IntelliJ 就回一個 404 —— 前端沒有 catch，於是整顆按鈕靜默失效（issue #18）。
     */
    @Test
    fun resyncRouteExistsAndReportsOk() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/tmp/does-not-matter", emptyMap())

        assertEquals(SpekHttpRequestHandler.ApiResult.Json("""{"ok":true}"""), result, "resync 必須被路由到，且回報成功")
    }

    /** 未知路徑仍須回 null（由呼叫端轉成 404），確認上面那條不是靠萬用比對矇到的。 */
    @Test
    fun unknownRouteReturnsNull() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/no-such-endpoint", "/tmp/does-not-matter", emptyMap())

        assertNull(result)
    }

    /** resync 不讀專案內容，故不得因為 projectPath 不存在而丟例外。 */
    @Test
    fun resyncDoesNotTouchTheProjectDirectory() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/nonexistent/project/path", emptyMap())

        assertEquals(SpekHttpRequestHandler.ApiResult.Json("""{"ok":true}"""), result)
    }

    /**
     * A schema name that resolves to nothing is a 404 **with a body**: the shared frontend reads
     * `reason` off it to tell "it does not exist" from "we could not look". A bare 404 would make a
     * missing openspec CLI read as a missing schema.
     */
    @Test
    fun unknownSchemaNameIsANotFoundCarryingAReason() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest(
            "openspec/schemas/no-such-schema",
            createTempProject().absolutePath,
            emptyMap(),
        )

        val notFound = assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(result)
        assertTrue(notFound.body.contains(""""reason":"""), "expected a reason in ${notFound.body}")
    }

    /**
     * A name failing the allowlist must not reach the CLI or the filesystem at all — it is rejected
     * as not-found rather than being looked up.
     */
    @Test
    fun unsafeSchemaNameIsRejectedAsNotFound() {
        val handler = SpekHttpRequestHandler()

        // `..` cannot appear in a path segment the router matches, so the traversal attempt that can
        // actually arrive is a single unsafe segment.
        val result = handler.routeRequest(
            "openspec/schemas/-leading",
            createTempProject().absolutePath,
            emptyMap(),
        )

        val notFound = assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(result)
        assertTrue(notFound.body.contains(""""reason":"not-found""""), notFound.body)
    }

    /**
     * A missing *resource* is not a missing *endpoint*. These routes matched — the spec simply is not
     * there — so answering "Endpoint not found" would be untrue, and it read identically to a typo in
     * the URL.
     */
    @Test
    fun missingResourcesSayWhatIsActuallyMissing() {
        val handler = SpekHttpRequestHandler()
        val project = createTempProject().absolutePath

        val spec = handler.routeRequest("openspec/specs/no-such-topic", project, emptyMap())
        assertTrue(assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(spec).body.contains("Spec not found"))

        val change = handler.routeRequest("openspec/changes/no-such-change", project, emptyMap())
        assertTrue(assertIs<SpekHttpRequestHandler.ApiResult.NotFound>(change).body.contains("Change not found"))

        // An endpoint that genuinely does not exist still returns null, so the two stay distinguishable.
        assertNull(handler.routeRequest("openspec/no-such-endpoint", project, emptyMap()))
    }

    /** The bare route is a plain 200 even with no schemas: the view renders its own empty state. */
    @Test
    fun schemasListIsAlwaysA200() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/schemas", createTempProject().absolutePath, emptyMap())

        val ok = assertIs<SpekHttpRequestHandler.ApiResult.Json>(result)
        assertTrue(ok.body.contains("\"schemas\""), ok.body)
    }

    private fun createTempProject(): File =
        File.createTempFile("spek-routes", "").let {
            it.delete()
            File(it, "openspec").mkdirs()
            it.deleteOnExit()
            it
        }

    /**
     * The two HTTP surfaces must answer a malformed search request the same way. This route used to
     * default a missing `q` to "" and answer 200 with an empty array, where the web endpoint answered
     * 400 — the same request, two answers, which is exactly what the shared search rule closes.
     */
    @Test
    fun searchRejectsAnAbsentOrRepeatedQueryParameter() {
        val handler = SpekHttpRequestHandler()
        val project = createTempProject().absolutePath

        val absent = handler.routeRequest("openspec/search", project, emptyMap())
        assertTrue(
            assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(absent).body.contains("q parameter is required"),
        )

        val repeated = handler.routeRequest("openspec/search", project, mapOf("q" to listOf("a", "b")))
        assertTrue(
            assertIs<SpekHttpRequestHandler.ApiResult.BadRequest>(repeated).body.contains("q must be given once"),
        )
    }

    /** Present but empty is a caller who searched for nothing, which is a 200 with no results. */
    @Test
    fun searchWithAnEmptyQueryIsAnEmptyResultSet() {
        val handler = SpekHttpRequestHandler()
        val project = createTempProject().absolutePath

        val blank = handler.routeRequest("openspec/search", project, mapOf("q" to listOf("  ")))
        assertEquals("[]", assertIs<SpekHttpRequestHandler.ApiResult.Json>(blank).body)
    }
}
