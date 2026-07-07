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

        val proposal = readFileOrNull(File(changeDir, "proposal.md"))
        val design = readFileOrNull(File(changeDir, "design.md"))

        val tasksContent = readFileOrNull(File(changeDir, "tasks.md"))
        val tasks = tasksContent?.let { TaskParser.parse(it) }

        val specsDir = File(changeDir, "specs")
        val specs = if (specsDir.isDirectory) {
            specsDir.listFiles()
                ?.filter { it.isDirectory && !it.name.startsWith(".") }
                ?.mapNotNull { topicDir ->
                    val specFile = File(topicDir, "spec.md")
                    if (specFile.exists()) {
                        ChangeSpec(topicDir.name, specFile.readText())
                    } else null
                }
                ?: emptyList()
        } else emptyList()

        // 讀取 .openspec.yaml metadata
        val metadata = readMetadata(File(changeDir, ".openspec.yaml"))

        // 重用 scanner 的 createdDate 解析；archivedDate 依 change 位於 changes/ 或 archive/<slug> 判定
        val createdDate = OpenSpecScanner.readCreatedDate(changeDir)
        val archivedDate = if (status == "archived") parseSlug(slug).first else null

        return ChangeDetail(
            slug = slug,
            createdDate = createdDate,
            archivedDate = archivedDate,
            proposal = proposal,
            design = design,
            tasks = tasks,
            specs = specs,
            metadata = metadata,
        )
    }

    private fun readFileOrNull(file: File): String? {
        return if (file.exists()) file.readText() else null
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
}
