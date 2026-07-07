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
            .map { scanChangeDir(it, "active") }
            .sortedByDescending { it.timestamp ?: it.date ?: "" }

        val archivedChanges = safeListDirs(archiveDir)
            .map { scanChangeDir(it, "archived") }
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

    private fun scanChangeDir(dir: File, status: String): ChangeInfo {
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

        val createdDate = readCreatedDate(dir)
        // archive folder 強制 YYYY-MM-DD-slug 命名（parseSlug 已處理），active 一律 null
        val archivedDate = if (status == "archived") date else null

        return ChangeInfo(
            slug = slug,
            date = date,
            timestamp = null,
            createdDate = createdDate,
            archivedDate = archivedDate,
            description = description,
            status = status,
            hasProposal = hasProposal,
            hasDesign = hasDesign,
            hasTasks = hasTasks,
            hasSpecs = hasSpecs,
            taskStats = taskStats,
        )
    }

    // 從 change 目錄的 .openspec.yaml 解出 createdDate；缺檔或格式不符（非 YYYY-MM-DD）回 null。
    // readLines() 會吃掉 CRLF/LF，故不受換行風格影響，行為對齊 TS scanner.ts 的 readCreatedDate。
    fun readCreatedDate(changeDir: File): String? {
        val yamlFile = File(changeDir, ".openspec.yaml")
        if (!yamlFile.exists()) return null
        for (line in yamlFile.readLines()) {
            val match = Regex("""^created:\s*(.+)$""").find(line) ?: continue
            val value = match.groupValues[1].trim()
            return if (Regex("""^\d{4}-\d{2}-\d{2}$""").matches(value)) value else null
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
