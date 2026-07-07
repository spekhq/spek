package com.spek.intellij.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * ChangeReader.read 的合併縫合測試：驗證單一 ChangeDetail 同時帶著 #6 的
 * {status, schema, artifacts, schemaOrder} 與 Timeline 的 {createdDate, archivedDate}。
 * 用 archived change：ChangeReader 對非 active change 不查 openspec CLI，故完全確定性、不需二進位。
 */
class ChangeReaderTest {

    @TempDir
    lateinit var repo: File

    private fun writeArchived(slug: String, yaml: String) {
        val base = File(repo, "openspec/changes/archive/$slug")
        File(base, "specs/topic-a").mkdirs()
        File(base, ".openspec.yaml").writeText(yaml)
        File(base, "proposal.md").writeText("## Why\n")
        File(base, "tasks.md").writeText("## Tasks\n- [x] a\n- [ ] b\n")
        File(base, "specs/topic-a/spec.md").writeText("## ADDED\nx\n")
    }

    @Test
    fun `archived change carries artifacts, dates and schema on one object`() {
        writeArchived("2026-03-01-add-widget", "schema: spec-driven\ncreated: 2026-02-25\n")
        val detail = ChangeReader.read(repo.absolutePath, "2026-03-01-add-widget")
        assertNotNull(detail)
        detail!!
        assertEquals("archived", detail.status)
        assertEquals("spec-driven", detail.schema)
        assertEquals("2026-02-25", detail.createdDate)
        assertEquals("2026-03-01", detail.archivedDate)
        assertNull(detail.schemaOrder)
        assertEquals(listOf("proposal", "specs", "tasks"), detail.artifacts.map { it.id }.sorted())
        val tasks = detail.artifacts.first { it.id == "tasks" }
        assertEquals("tasks", tasks.kind)
        assertEquals(2, tasks.tasks?.total)
    }

    @Test
    fun `quoted schema value is cleaned on the change-detail badge`() {
        writeArchived("2026-03-02-add-thing", "schema: \"custom-1.0\"  # note\ncreated: 2026-03-01\n")
        val detail = ChangeReader.read(repo.absolutePath, "2026-03-02-add-thing")
        assertNotNull(detail)
        assertEquals("custom-1.0", detail!!.schema)
    }

    @Test
    fun `missing change returns null`() {
        assertNull(ChangeReader.read(repo.absolutePath, "does-not-exist"))
    }
}
