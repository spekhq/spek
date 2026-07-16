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
    fun `defaultSchema is the repo default even when the change declares another schema`() {
        File(repo, "openspec").mkdirs()
        File(repo, "openspec/config.yaml").writeText("schema: spec-driven\n")
        writeArchived("2026-03-03-add-bridge", "schema: superpowers-bridge\ncreated: 2026-03-01\n")
        val detail = ChangeReader.read(repo.absolutePath, "2026-03-03-add-bridge")
        assertNotNull(detail)
        detail!!
        assertEquals("superpowers-bridge", detail.schema)
        assertEquals("spec-driven", detail.defaultSchema)
    }

    @Test
    fun `missing change returns null`() {
        assertNull(ChangeReader.read(repo.absolutePath, "does-not-exist"))
    }

    // --- schema-order provider guard（注入 provider 以確定性驗證「有沒有真的呼叫」，不觸真實 CLI）---

    private fun writeActive(slug: String, yaml: String?) {
        val base = File(repo, "openspec/changes/$slug")
        base.mkdirs()
        if (yaml != null) File(base, ".openspec.yaml").writeText(yaml)
        File(base, "proposal.md").writeText("## Why\n")
    }

    /** 計數用 provider：記錄呼叫次數與收到的 schema，回一個固定 refs（若被呼叫）。 */
    private class CountingProvider : SchemaOrderProvider {
        var calls = 0
        var sawNullSchema = false
        var lastSchema: String? = null
        override fun order(repoRoot: String, slug: String, schema: String?): List<SchemaArtifactRef>? {
            calls++
            if (schema == null) sawNullSchema = true
            lastSchema = schema
            return listOf(SchemaArtifactRef("proposal", "proposal.md"))
        }
    }

    @Test
    fun `active change with no schema locally still consults the provider (CLI resolves a default)`() {
        // 無 openspec/config.yaml、change 也未宣告 schema → spek 本地解析不出 → schema 為 null。
        // 但 null 不代表無權威順序：CLI 會自行解析出內建預設 → provider 仍須被呼叫。
        writeActive("no-schema", "created: 2026-01-01\n")
        val provider = CountingProvider()
        val detail = ChangeReader.read(repo.absolutePath, "no-schema", provider)
        assertNotNull(detail)
        assertNull(detail!!.schema)
        assertEquals(1, provider.calls)
        assertEquals(true, provider.sawNullSchema)
        assertEquals(listOf("proposal"), detail.schemaOrder)
    }

    @Test
    fun `active change with an empty-string schema still consults the provider`() {
        // schema: "" → cleanScalar 產出 ""；一樣本地解析不出，仍須查 CLI（provider 內把 "" 折進預設桶）
        writeActive("empty-schema", "schema: \"\"\ncreated: 2026-01-01\n")
        val provider = CountingProvider()
        val detail = ChangeReader.read(repo.absolutePath, "empty-schema", provider)
        assertNotNull(detail)
        assertEquals("", detail!!.schema)
        assertEquals(1, provider.calls)
        assertEquals(listOf("proposal"), detail.schemaOrder)
    }

    @Test
    fun `an empty slug is not a change and never calls the provider`() {
        File(repo, "openspec").mkdirs()
        File(repo, "openspec/config.yaml").writeText("schema: spec-driven\n")
        File(repo, "openspec/changes").mkdirs()
        val provider = CountingProvider()
        val detail = ChangeReader.read(repo.absolutePath, "", provider)
        assertNull(detail)
        assertEquals(0, provider.calls)
    }

    @Test
    fun `active change with a schema calls the provider with that schema`() {
        writeActive("add-bridge", "schema: superpowers-bridge\ncreated: 2026-01-01\n")
        val provider = CountingProvider()
        val detail = ChangeReader.read(repo.absolutePath, "add-bridge", provider)
        assertNotNull(detail)
        assertEquals(1, provider.calls)
        assertEquals("superpowers-bridge", provider.lastSchema)
        assertEquals(listOf("proposal"), detail!!.schemaOrder)
    }
}
