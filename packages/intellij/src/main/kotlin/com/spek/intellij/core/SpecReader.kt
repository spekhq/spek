package com.spek.intellij.core

import java.io.File

object SpecReader {

    fun read(projectPath: String, topic: String): SpecDetail? {
        val specFile = SpecFiles.resolve(File(projectPath, "openspec/specs"), topic) ?: return null

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
        if (!SpecTopic.isSafeChangeSlug(slug)) return null
        val base = File(projectPath, "openspec/changes")

        // Active changes first, then the archive.
        for (changeDir in listOf(File(base, slug), File(base, "archive/$slug"))) {
            val specFile = SpecFiles.resolve(File(changeDir, "specs"), topic) ?: continue
            return SpecVersionContent(specFile.readText())
        }

        return null
    }

    private fun findRelatedChanges(projectPath: String, topic: String): List<String> {
        val base = File(projectPath, "openspec")
        val changesDir = File(base, "changes")
        val archiveDir = File(changesDir, "archive")
        val related = mutableListOf<String>()
        // Exact full topic: a parent, its child, and a same-named spec in another folder each keep their own history.
        fun hasDelta(changeDir: File) = SpecFiles.resolve(File(changeDir, "specs"), topic) != null

        // 搜尋 active changes
        changesDir.listFiles()
            ?.filter { it.isDirectory && it.name != "archive" && !it.name.startsWith(".") }
            ?.forEach { dir ->
                if (hasDelta(dir)) related.add(dir.name)
            }

        // 搜尋 archived changes
        archiveDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.forEach { dir ->
                if (hasDelta(dir)) related.add(dir.name)
            }

        return related
    }
}
