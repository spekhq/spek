package com.spek.intellij.core

import java.io.File

object ChangeReader {

    fun read(projectPath: String, slug: String): ChangeDetail? {
        val base = File(projectPath, "openspec/changes")

        // 在 active 和 archive 中尋找
        var changeDir = File(base, slug)
        var status = "active"
        if (!changeDir.exists()) {
            changeDir = File(base, "archive/$slug")
            status = "archived"
        }
        if (!changeDir.exists()) return null

        // 讀取 .openspec.yaml metadata
        val metadata = readMetadata(File(changeDir, ".openspec.yaml"))

        // change schema：優先 change .openspec.yaml，否則 fallback 回 repo config.yaml（僅供顯示 badge）
        val schema = readChangeSchema(projectPath, changeDir)
        // artifact 依 mtime 由新到舊排序（見 ArtifactDiscovery）
        val artifacts = ArtifactDiscovery.discover(changeDir)
        // schema 權威順序（供前端 schema-order 排序用）：只對 active change 查詢 CLI，
        // archived change 無 planningArtifacts，直接為 null（前端顯示 archived 退回訊息）
        val refs = if (status == "active") SchemaOrder.cli.order(projectPath, slug) else null
        val schemaOrder = SchemaOrder.resolveSchemaOrder(refs, artifacts.map { it.id })
        // Timeline 生命週期：重用 scanner 的 createdDate 解析；archivedDate 依 status 判定
        val createdDate = OpenSpecScanner.readCreatedDate(changeDir)
        val archivedDate = if (status == "archived") parseSlug(slug).first else null

        return ChangeDetail(
            slug = slug,
            status = status,
            schema = schema,
            artifacts = artifacts,
            schemaOrder = schemaOrder,
            createdDate = createdDate,
            archivedDate = archivedDate,
            metadata = metadata,
        )
    }

    private fun readMetadata(file: File): Map<String, String>? {
        if (!file.exists()) return null
        val result = mutableMapOf<String, String>()
        for (line in file.readLines()) {
            val match = Regex("""^(\w+):\s*(.+)$""").find(line)
            if (match != null) {
                result[match.groupValues[1]] = match.groupValues[2].trim()
            }
        }
        return result
    }

    /** change schema：change .openspec.yaml 的 schema → repo openspec/config.yaml 的 schema → null */
    private fun readChangeSchema(projectPath: String, changeDir: File): String? {
        val changeYaml = File(changeDir, ".openspec.yaml")
        if (changeYaml.exists()) {
            val meta = readMetadata(changeYaml)
            meta?.get("schema")?.let { return cleanScalar(it) }
        }
        return readRepoSchema(projectPath)
    }

    private fun readRepoSchema(projectPath: String): String? {
        val config = File(projectPath, "openspec/config.yaml")
        if (!config.exists()) return null
        val m = Regex("""^schema:\s*(.+)$""", RegexOption.MULTILINE).find(config.readText())
        return m?.groupValues?.get(1)?.let { cleanScalar(it) }
    }
}
