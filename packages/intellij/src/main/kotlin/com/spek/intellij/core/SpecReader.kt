package com.spek.intellij.core

import java.io.File

object SpecReader {

    fun read(projectPath: String, topic: String): SpecDetail? {
        val specFile = File(projectPath, "openspec/specs/$topic/spec.md")
        if (!specFile.exists()) return null

        val content = specFile.readText()
        val relatedChanges = findRelatedChanges(projectPath, topic)

        val base = File(projectPath, "openspec")
        val archiveDir = File(base, "changes/archive")

        val history = relatedChanges.map { slug ->
            val (date, description) = parseSlug(slug)
            val isArchived = File(archiveDir, slug).exists()
            HistoryEntry(
                slug = slug,
                date = date,
                timestamp = null,
                description = description,
                status = if (isArchived) "archived" else "active",
            )
        }.sortedByDescending { it.date ?: "" }

        return SpecDetail(
            topic = topic,
            content = content,
            relatedChanges = relatedChanges,
            history = history,
        )
    }

    fun readAtChange(projectPath: String, topic: String, slug: String): SpecVersionContent? {
        val base = File(projectPath, "openspec/changes")

        // 先檢查 active changes
        var specFile = File(base, "$slug/specs/$topic/spec.md")
        if (specFile.exists()) return SpecVersionContent(specFile.readText())

        // 再檢查 archive
        specFile = File(base, "archive/$slug/specs/$topic/spec.md")
        if (specFile.exists()) return SpecVersionContent(specFile.readText())

        return null
    }

    private fun findRelatedChanges(projectPath: String, topic: String): List<String> {
        val base = File(projectPath, "openspec")
        val changesDir = File(base, "changes")
        val archiveDir = File(changesDir, "archive")
        val related = mutableListOf<String>()

        // 搜尋 active changes
        changesDir.listFiles()
            ?.filter { it.isDirectory && it.name != "archive" && !it.name.startsWith(".") }
            ?.forEach { dir ->
                if (File(dir, "specs/$topic/spec.md").exists()) {
                    related.add(dir.name)
                }
            }

        // 搜尋 archived changes
        archiveDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.forEach { dir ->
                if (File(dir, "specs/$topic/spec.md").exists()) {
                    related.add(dir.name)
                }
            }

        return related
    }
}
