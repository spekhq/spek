package com.spek.intellij.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/**
 * OpenSpecScanner 的純邏輯測試：驗證 createdDate / archivedDate 由 .openspec.yaml 與資料夾名解析，
 * 行為對齊 TS @spek/core 的 scanner。此測試不依賴 IntelliJ platform。
 */
class OpenSpecScannerTest {

    @TempDir
    lateinit var repo: File

    private fun writeChange(group: String, slug: String, yaml: String?) {
        val base = when (group) {
            "active" -> File(repo, "openspec/changes/$slug")
            else -> File(repo, "openspec/changes/archive/$slug")
        }
        base.mkdirs()
        File(base, "proposal.md").writeText("## Why\n")
        if (yaml != null) {
            File(base, ".openspec.yaml").writeText(yaml)
        }
    }

    @Test
    fun `active change reads createdDate from openspec yaml`() {
        writeChange("active", "add-foo", "schema: spec-driven\ncreated: 2026-07-05\n")
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.activeChanges.size)
        assertEquals("2026-07-05", result.activeChanges[0].createdDate)
        assertNull(result.activeChanges[0].archivedDate)
    }

    @Test
    fun `archived change reads createdDate and derives archivedDate from folder name`() {
        writeChange("archived", "2026-07-05-fix-x", "schema: spec-driven\ncreated: 2026-07-01\n")
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.archivedChanges.size)
        assertEquals("2026-07-01", result.archivedChanges[0].createdDate)
        assertEquals("2026-07-05", result.archivedChanges[0].archivedDate)
    }

    @Test
    fun `missing openspec yaml yields null createdDate`() {
        writeChange("active", "no-yaml", null)
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.activeChanges.size)
        assertNull(result.activeChanges[0].createdDate)
    }

    @Test
    fun `malformed created value yields null createdDate`() {
        writeChange("active", "bad-date", "created: not-a-date\n")
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.activeChanges.size)
        assertNull(result.activeChanges[0].createdDate)
    }

    @Test
    fun `CRLF openspec yaml still reads createdDate`() {
        writeChange("active", "crlf-foo", "schema: spec-driven\r\ncreated: 2026-07-05\r\n")
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.activeChanges.size)
        assertEquals("2026-07-05", result.activeChanges[0].createdDate)
    }

    // 與 change-detail badge 一致：list badge 也需經 cleanScalar 去引號 / 行內註解
    @Test
    fun `quoted schema is cleaned on the changes-list badge`() {
        writeChange("active", "add-thing", "schema: \"custom-1.0\"  # note\ncreated: 2026-07-05\n")
        val result = OpenSpecScanner.scan(repo.absolutePath)
        assertEquals(1, result.activeChanges.size)
        assertEquals("custom-1.0", result.activeChanges[0].schema)
    }
}
