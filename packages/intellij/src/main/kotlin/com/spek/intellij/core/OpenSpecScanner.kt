package com.spek.intellij.core

import java.io.File

object OpenSpecScanner {

    fun hasOpenSpec(projectPath: String): Boolean {
        val base = File(projectPath, "openspec")
        return File(base, "config.yaml").exists() ||
            (File(base, "specs").isDirectory && File(base, "changes").isDirectory)
    }

    fun scan(projectPath: String): ScanResult {
        val base = File(projectPath, "openspec")
        val specsDir = File(base, "specs")
        val changesDir = File(base, "changes")
        val archiveDir = File(changesDir, "archive")

        val specs = safeListDirs(specsDir)
            .filter { File(it, "spec.md").exists() }
            .map { dir ->
                SpecInfo(
                    topic = dir.name,
                    path = File(dir, "spec.md").absolutePath,
                    historyCount = 0,
                )
            }
            .sortedBy { it.topic }
            .toMutableList()

        val activeChanges = safeListDirs(changesDir)
            .filter { it.name != "archive" }
            .map { scanChangeDir(projectPath, it, "active") }
            .sortedByDescending { it.timestamp ?: it.date ?: "" }

        val archivedChanges = safeListDirs(archiveDir)
            .map { scanChangeDir(projectPath, it, "archived") }
            .sortedByDescending { it.timestamp ?: it.date ?: "" }

        // 計算每個 spec 被多少 changes 引用
        val allChangeDirs = safeListDirs(changesDir).filter { it.name != "archive" } +
            safeListDirs(archiveDir)

        for (i in specs.indices) {
            val topic = specs[i].topic
            val count = allChangeDirs.count { dir ->
                File(dir, "specs/$topic/spec.md").exists()
            }
            specs[i] = specs[i].copy(historyCount = count)
        }

        return ScanResult(specs, activeChanges, archivedChanges)
    }

    private fun scanChangeDir(projectPath: String, dir: File, status: String): ChangeInfo {
        val slug = dir.name
        val (date, description) = parseSlug(slug)
        val hasProposal = File(dir, "proposal.md").exists()
        val hasDesign = File(dir, "design.md").exists()
        val hasTasks = File(dir, "tasks.md").exists()
        val hasSpecs = File(dir, "specs").isDirectory

        val taskStats = if (hasTasks) {
            val content = File(dir, "tasks.md").readText()
            val parsed = TaskParser.parse(content)
            TaskStats(parsed.total, parsed.completed)
        } else null

        return ChangeInfo(
            slug = slug,
            date = date,
            timestamp = null,
            description = description,
            status = status,
            hasProposal = hasProposal,
            hasDesign = hasDesign,
            hasTasks = hasTasks,
            hasSpecs = hasSpecs,
            artifactCount = ArtifactDiscovery.count(dir),
            schema = readChangeSchema(projectPath, dir),
            taskStats = taskStats,
        )
    }

    /** change schema：change .openspec.yaml 的 schema → repo openspec/config.yaml → null */
    private fun readChangeSchema(projectPath: String, dir: File): String? {
        val changeYaml = File(dir, ".openspec.yaml")
        if (changeYaml.exists()) {
            val m = Regex("""^schema:\s*(.+)$""", RegexOption.MULTILINE).find(changeYaml.readText())
            if (m != null) return m.groupValues[1].trim()
        }
        val config = File(projectPath, "openspec/config.yaml")
        if (config.exists()) {
            val m = Regex("""^schema:\s*(.+)$""", RegexOption.MULTILINE).find(config.readText())
            if (m != null) return m.groupValues[1].trim()
        }
        return null
    }

    private fun safeListDirs(dir: File): List<File> {
        if (!dir.isDirectory) return emptyList()
        return dir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.toList()
            ?: emptyList()
    }
}

data class ScanResult(
    val specs: List<SpecInfo>,
    val activeChanges: List<ChangeInfo>,
    val archivedChanges: List<ChangeInfo>,
)

fun parseSlug(slug: String): Pair<String?, String> {
    val match = Regex("""^(\d{4}-\d{2}-\d{2})-(.+)$""").find(slug)
    return if (match != null) {
        match.groupValues[1] to match.groupValues[2].replace("-", " ")
    } else {
        null to slug.replace("-", " ")
    }
}
