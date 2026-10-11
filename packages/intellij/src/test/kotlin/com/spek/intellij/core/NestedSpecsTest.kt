package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assumptions.assumeTrue
import java.io.File
import java.nio.file.Files
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The shared nested-specs repository, scanned here and by packages/core/src/nested-specs.test.ts. Both
 * read `expected.json` beside it, so the two scanners are held to one answer rather than two copies.
 */
class NestedSpecsTest {

    private val fixture = File(
        System.getProperty("spek.nestedSpecsFixture")
            ?: error("spek.nestedSpecsFixture is not set; run through Gradle's test task"),
    )
    private val project = fixture.absolutePath
    private val expected: JsonObject = Json.parseToJsonElement(File(fixture, "expected.json").readText()).jsonObject
    private val expectedTopics = expected["topics"]!!.jsonArray.map { it.jsonPrimitive.content }

    @Test
    fun `every nested spec is a topic, in the same order as the TypeScript scanner`() {
        assertEquals(expectedTopics, OpenSpecScanner.scan(project).specs.map { it.topic })
    }

    @Test
    fun `history counts follow the exact nested topic`() {
        val counts = expected["historyCounts"]!!.jsonObject.mapValues { it.value.jsonPrimitive.int }
        assertEquals(counts, OpenSpecScanner.scan(project).specs.associate { it.topic to it.historyCount })
    }

    @Test
    fun `parent, child, and same-basename histories stay separate`() {
        fun history(topic: String) = SpecReader.read(project, topic)!!.relatedChanges
        assertEquals(listOf("2026-01-10-add-pagination"), history("contracts/pagination"))
        assertEquals(listOf("add-streaming-search"), history("contracts/pagination/streaming-search"))
        assertEquals(listOf("2026-02-01-add-guides"), history("guides/pagination"))
    }

    @Test
    fun `a version read uses the exact topic and never substitutes a parent`() {
        val child = SpecReader.readAtChange(project, "contracts/pagination/streaming-search", "add-streaming-search")
        assertTrue(child!!.content.contains("DELTAONLYTERM"))
        assertNotNull(SpecReader.readAtChange(project, "contracts/pagination", "2026-01-10-add-pagination"))
        assertNull(SpecReader.readAtChange(project, "contracts/pagination/streaming-search", "2026-01-10-add-pagination"))
        assertNull(SpecReader.readAtChange(project, "contracts/pagination", "add-streaming-search"))
        assertNull(SpecReader.readAtChange(project, "contracts/pagination", "../add-streaming-search"))
        assertNull(SpecReader.readAtChange(project, "contracts/pagination", "archive"))
    }

    @Test
    fun `a nested delta is the change's Specs artifact, counted once`() {
        val detail = ChangeReader.read(project, "add-streaming-search") { _, _, _ -> null }
        val specs = detail!!.artifacts.single { it.kind == "specs" }.specs!!
        assertEquals(listOf("contracts/pagination/streaming-search"), specs.map { it.topic })
        assertEquals(2, ArtifactFiles.count(File(fixture, "openspec/changes/add-streaming-search")))
    }

    @Test
    fun `graph edges target the exact nested spec node`() {
        val graph = GraphBuilder.build(project)
        assertEquals(expectedTopics.map { "spec:$it" }, graph.nodes.filter { it.type == "spec" }.map { it.id })
        val edges = expected["edges"]!!.jsonArray.map { pair ->
            (pair as JsonArray).let { it[0].jsonPrimitive.content to it[1].jsonPrimitive.content }
        }
        assertEquals(edges, graph.edges.map { it.source to it.target }.sortedBy { "${it.first},${it.second}" })
    }

    @Test
    fun `nested main specs are distinct search documents and nested deltas are not searched`() {
        val docs = SearchService.collectDocuments(project).filter { it.type == "spec" }.map { it.name }
        assertEquals(expectedTopics, docs)
        for ((query, topics) in expected["searchSpecTopics"]!!.jsonObject) {
            val found = SearchService.search(project, query).filter { it.type == "spec" }.map { it.topic }
            assertEquals(topics.jsonArray.map { it.jsonPrimitive.content }, found, query)
        }
        assertTrue(SearchService.search(project, "DELTAONLYTERM").isEmpty())
    }

    @Test
    fun `malformed and hidden topics read as absent`() {
        for (topic in listOf("../specs/auth", "contracts//pagination", "/auth", "auth/", "auth\n", ".drafts/hidden", "", "a\\b")) {
            assertNull(SpecReader.read(project, topic), topic)
        }
        assertNull(SpecReader.read(project, File(fixture, "openspec/specs/auth").absolutePath))
    }

    @Test
    fun `the topic validator matches the TypeScript rule`() {
        for (ok in listOf("auth", "contracts/pagination", "a b", "x.y")) assertTrue(SpecTopic.isSafeTopic(ok), ok)
        for (bad in listOf("", "..", ".", "../x", "a//b", "/a", "a/", "a\\b", "auth\n", "auth\r", "a\u0000b", ".drafts/x", "a/.b")) {
            assertFalse(SpecTopic.isSafeTopic(bad), bad)
        }
        assertTrue(SpecTopic.isSafeChangeSlug("2026-01-10-add-pagination"))
        for (bad in listOf("", "a/b", "..", ".x", "archive", "add\n")) assertFalse(SpecTopic.isSafeChangeSlug(bad), bad)
        assertEquals("/specs/a%20b/c%23d%3Fe%25f", SpecTopic.route("a b/c#d?e%f"))
    }

    // --- Cases built in a temp dir ------------------------------------------------------------------

    private fun tempRepo(files: Map<String, String>): File {
        val repo = Files.createTempDirectory("spek-nested-test-").toFile()
        for ((rel, content) in files) {
            val f = File(repo, "openspec/$rel")
            f.parentFile.mkdirs()
            f.writeText(content)
        }
        return repo
    }

    /** Symlinks are made at runtime, not committed; skipped where the OS refuses (Windows without
     *  Developer Mode). */
    private fun link(link: File, target: File) {
        val made = try {
            Files.createSymbolicLink(link.toPath(), target.toPath())
            true
        } catch (e: Exception) {
            false
        }
        assumeTrue(made, "cannot create a symlink here; on Windows enable Developer Mode")
    }

    private fun topics(repo: File) = OpenSpecScanner.scan(repo.absolutePath).specs.map { it.topic }

    @Test
    fun `topics order by code unit`() {
        val repo = tempRepo(mapOf("specs/ab/spec.md" to "x", "specs/a/c/spec.md" to "x", "specs/a-b/spec.md" to "x", "specs/a/spec.md" to "x"))
        assertEquals(listOf("a", "a-b", "a/c", "ab"), topics(repo))
    }

    @Test
    fun `a nested delta's mtime is the specs artifact's mtime`() {
        val repo = tempRepo(mapOf("changes/c/proposal.md" to "x", "changes/c/specs/contracts/pagination/spec.md" to "x"))
        val nested = File(repo, "openspec/changes/c/specs/contracts/pagination/spec.md")
        val future = System.currentTimeMillis() + 86_400_000L
        nested.setLastModified(future)
        assertEquals(nested.lastModified(), ArtifactFiles.specsMtime(File(repo, "openspec/changes/c")))
    }

    @Test
    fun `symlinked spec md inside its capability or elsewhere in specs is discovered`() {
        val repo = tempRepo(mapOf("specs/auth/real.md" to "REAL", "specs/shared/b.md" to "SHARED", "specs/b/.keep" to ""))
        val specs = File(repo, "openspec/specs")
        link(File(specs, "auth/spec.md"), File(specs, "auth/real.md"))
        link(File(specs, "b/spec.md"), File(specs, "shared/b.md"))
        assertEquals(listOf("auth", "b"), topics(repo))
        assertEquals("SHARED", SpecReader.read(repo.absolutePath, "b")!!.content)
    }

    @Test
    fun `symlinked spec md escaping specs is rejected and the scan goes on`() {
        val repo = tempRepo(mapOf("specs/ok/spec.md" to "x", "specs/auth/.keep" to "", "secret.md" to "SECRET"))
        link(File(repo, "openspec/specs/auth/spec.md"), File(repo, "openspec/secret.md"))
        assertEquals(listOf("ok"), topics(repo))
        assertNull(SpecReader.read(repo.absolutePath, "auth"))
    }

    @Test
    fun `a dangling spec md link is skipped`() {
        val repo = tempRepo(mapOf("specs/auth/.keep" to ""))
        link(File(repo, "openspec/specs/auth/spec.md"), File(repo, "openspec/specs/auth/gone.md"))
        assertEquals(emptyList(), topics(repo))
    }

    @Test
    fun `a symlinked directory is not followed and a topic through it is not readable`() {
        val repo = tempRepo(mapOf("specs/contracts/pagination/spec.md" to "x", "vendor/api/spec.md" to "x"))
        val specs = File(repo, "openspec/specs")
        link(File(specs, "vendor"), File(repo, "openspec/vendor"))
        link(File(specs, "alias"), File(specs, "contracts"))
        assertEquals(listOf("contracts/pagination"), topics(repo))
        assertNull(SpecReader.read(repo.absolutePath, "alias/pagination"))
        assertNull(SpecReader.read(repo.absolutePath, "vendor/api"))
        assertNotNull(SpecReader.read(repo.absolutePath, "contracts/pagination"))
    }
}
