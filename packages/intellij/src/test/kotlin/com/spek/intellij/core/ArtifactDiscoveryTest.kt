package com.spek.intellij.core

import java.io.File
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals

class ArtifactDiscoveryTest {

    private val tempDirs = mutableListOf<File>()

    private fun mkRepo(): File {
        val dir = Files.createTempDirectory("spek-kt-test-").toFile()
        tempDirs.add(dir)
        return dir
    }

    private fun writeChange(repo: File, slug: String, files: Map<String, String>): File {
        val changeDir = File(repo, "openspec/changes/$slug")
        changeDir.mkdirs()
        for ((rel, content) in files) {
            val full = File(changeDir, rel)
            full.parentFile.mkdirs()
            full.writeText(content)
        }
        return changeDir
    }

    // 明確設定某檔案的 mtime（秒），讓排序測試不受寫入時序影響
    private fun setMtime(changeDir: File, rel: String, seconds: Long) {
        File(changeDir, rel).setLastModified(seconds * 1000L)
    }

    // 讓 change 內所有 *.md（含 specs 內）共用同一 mtime，模擬剛 clone/checkout 的狀態
    private fun levelMtimes(dir: File, seconds: Long) {
        dir.listFiles()?.forEach { f ->
            if (f.isDirectory) levelMtimes(f, seconds)
            else if (f.name.lowercase().endsWith(".md")) f.setLastModified(seconds * 1000L)
        }
    }

    @AfterTest
    fun cleanup() {
        tempDirs.forEach { it.deleteRecursively() }
    }

    @Test
    fun ordersByMtimeNewestFirst() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "add-foo",
            mapOf(
                "proposal.md" to "## Why\n",
                "design.md" to "## Context\n",
                "tasks.md" to "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 1000)
        setMtime(changeDir, "design.md", 2000)
        setMtime(changeDir, "tasks.md", 3000) // newest -> first
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("tasks", "design", "proposal"), arts.map { it.id })
    }

    @Test
    fun preservesKindsAndParsedDataWhileOrderingByMtime() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "add-foo",
            mapOf(
                "proposal.md" to "## Why\n",
                "tasks.md" to "## 1. Group\n\n- [x] 1.1 done\n- [ ] 1.2 todo\n",
                "specs/foo/spec.md" to "## ADDED Requirements\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 3000) // newest markdown
        setMtime(changeDir, "tasks.md", 1000)
        setMtime(changeDir, "specs/foo/spec.md", 2000)
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal", "specs", "tasks"), arts.map { it.id })
        val specs = arts.first { it.id == "specs" }
        assertEquals("specs", specs.kind)
        assertEquals(listOf("foo"), specs.specs?.map { it.topic })
        val tasks = arts.first { it.id == "tasks" }
        assertEquals("tasks", tasks.kind)
        assertEquals(2, tasks.tasks?.total)
        assertEquals(1, tasks.tasks?.completed)
    }

    @Test
    fun specsSortsByNewestDeltaFile() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
                "specs/bar/spec.md" to "x\n",
            ),
        )
        setMtime(changeDir, "proposal.md", 3000)
        setMtime(changeDir, "specs/bar/spec.md", 2000)
        setMtime(changeDir, "specs/foo/spec.md", 5000) // newest delta -> specs leads
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("specs", "proposal"), arts.map { it.id })
    }

    @Test
    fun equalMtimesFallBackToDefaultOrder() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "zebra.md" to "x\n",
                "tasks.md" to "## 1. G\n\n- [ ] 1.1 a\n",
                "apple.md" to "x\n",
                "proposal.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
            ),
        )
        levelMtimes(changeDir, 1000) // everything shares one mtime, as after a fresh clone
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal", "specs", "tasks", "apple", "zebra"), arts.map { it.id })
    }

    @Test
    fun customSchemaFilesOrderedByMtime() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "bridge-change",
            mapOf(
                "brainstorm.md" to "raw\n",
                "proposal.md" to "## Why\n",
                "plan.md" to "plan\n",
                "verify.md" to "verify\n",
                "retrospective.md" to "retro\n",
            ),
        )
        setMtime(changeDir, "brainstorm.md", 1000)
        setMtime(changeDir, "proposal.md", 2000)
        setMtime(changeDir, "plan.md", 5000) // newest
        setMtime(changeDir, "verify.md", 3000)
        setMtime(changeDir, "retrospective.md", 4000)
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(
            listOf("plan", "retrospective", "verify", "proposal", "brainstorm"),
            arts.map { it.id },
        )
        val retro = arts.first { it.id == "retrospective" }
        assertEquals("Retrospective", retro.title)
        assertEquals("markdown", retro.kind)
    }

    @Test
    fun ignoresDotfilesAndNonMarkdown() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "## Why\n",
                ".openspec.yaml" to "schema: spec-driven\n",
                "notes.txt" to "ignore me\n",
            ),
        )
        val arts = ArtifactDiscovery.discover(changeDir)
        assertEquals(listOf("proposal"), arts.map { it.id })
    }

    @Test
    fun countsRootMarkdownPlusSpecs() {
        val repo = mkRepo()
        val changeDir = writeChange(
            repo, "c",
            mapOf(
                "proposal.md" to "x\n",
                "design.md" to "x\n",
                "tasks.md" to "x\n",
                "specs/foo/spec.md" to "x\n",
                ".openspec.yaml" to "schema: spec-driven\n",
                "notes.txt" to "x\n",
            ),
        )
        assertEquals(4, ArtifactDiscovery.count(changeDir))
    }
}
