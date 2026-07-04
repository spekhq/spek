package com.spek.intellij.core

import java.io.File

/**
 * 對齊 @spek/core 的 artifacts.ts：以檔案系統為準探索 change artifacts，
 * 依檔案 mtime 由新到舊排序（相同 mtime 以預設敘事順序 tiebreak）。不呼叫 openspec CLI。
 */
object ArtifactDiscovery {

    private val DEFAULT_ORDER = listOf("proposal", "design", "specs", "tasks")

    /** 由檔名（去副檔名）產生顯示標題：dash/underscore → 空格、字首大寫 */
    private fun humanize(stem: String): String {
        return stem.replace(Regex("""[-_]+"""), " ").trim()
            .split(" ")
            .joinToString(" ") { w -> if (w.isEmpty()) w else w.replaceFirstChar { it.uppercase() } }
    }

    /** 讀取 specs/ delta tree，依 topic 排序 */
    private fun readSpecsTree(changeDir: File): List<ChangeSpec> {
        val specsDir = File(changeDir, "specs")
        if (!specsDir.isDirectory) return emptyList()
        val out = mutableListOf<ChangeSpec>()
        specsDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.forEach { topicDir ->
                val specFile = File(topicDir, "spec.md")
                if (specFile.exists()) out.add(ChangeSpec(topicDir.name, specFile.readText()))
            }
        return out.sortedBy { it.topic }
    }

    /** specs artifact 的排序時間：所有 specs/&#42;&#42;/spec.md 中最新的 mtime（無檔案回 0） */
    private fun specsMtime(changeDir: File): Long {
        val specsDir = File(changeDir, "specs")
        if (!specsDir.isDirectory) return 0L
        var newest = 0L
        specsDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.forEach { topicDir ->
                val specFile = File(topicDir, "spec.md")
                if (specFile.exists()) newest = maxOf(newest, specFile.lastModified())
            }
        return newest
    }

    /** root *.md（忽略 dotfile/非 md），依檔名排序 */
    private fun rootMarkdownFiles(changeDir: File): List<File> {
        return changeDir.listFiles()
            ?.filter { it.isFile && !it.name.startsWith(".") && it.name.lowercase().endsWith(".md") }
            ?.sortedBy { it.name }
            ?: emptyList()
    }

    /** artifact 數量（root *.md + specs/ 非空各算一個），不讀內容 */
    fun count(changeDir: File): Int {
        if (!changeDir.exists()) return 0
        var n = rootMarkdownFiles(changeDir).size
        if (readSpecsTree(changeDir).isNotEmpty()) n += 1
        return n
    }

    /**
     * 動態探索 change 目錄的 artifacts，依 mtime 由新到舊排序：root 檔案取自身 mtime、
     * specs 取其 delta 檔案中最新的 mtime。相同 mtime（例如剛 clone/checkout）以 DEFAULT_ORDER
     * 優先、其餘字母序作穩定 tiebreak。
     */
    fun discover(changeDir: File): List<ChangeArtifact> {
        if (!changeDir.exists()) return emptyList()

        val built = LinkedHashMap<String, ChangeArtifact>()
        val mtimes = HashMap<String, Long>()

        for (file in rootMarkdownFiles(changeDir)) {
            val stem = file.name.replace(Regex("""\.md$""", RegexOption.IGNORE_CASE), "")
            val content = file.readText()
            mtimes[stem] = file.lastModified()
            if (file.name.equals("tasks.md", ignoreCase = true)) {
                built[stem] = ChangeArtifact(id = stem, title = humanize(stem), kind = "tasks", tasks = TaskParser.parse(content))
            } else {
                built[stem] = ChangeArtifact(id = stem, title = humanize(stem), kind = "markdown", content = content)
            }
        }

        val specs = readSpecsTree(changeDir)
        if (specs.isNotEmpty()) {
            built["specs"] = ChangeArtifact(id = "specs", title = "Specs", kind = "specs", specs = specs)
            mtimes["specs"] = specsMtime(changeDir)
        }

        // mtime 由新到舊；相同 mtime 以 DEFAULT_ORDER 優先、其餘字母序作穩定 tiebreak
        return built.keys.sortedWith(
            Comparator { a, b ->
                val ma = mtimes[a] ?: 0L
                val mb = mtimes[b] ?: 0L
                if (ma != mb) return@Comparator mb.compareTo(ma)
                val ia = DEFAULT_ORDER.indexOf(a).let { if (it == -1) Int.MAX_VALUE else it }
                val ib = DEFAULT_ORDER.indexOf(b).let { if (it == -1) Int.MAX_VALUE else it }
                if (ia != ib) ia - ib else a.compareTo(b)
            }
        ).map { built.getValue(it) }
    }
}
