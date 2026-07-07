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

    /**
     * specs/ 是否含至少一個 spec.md —— 只檢查存在、第一個命中即回 true，不讀取任何內容。
     * 供 count 在 changes 列表熱路徑上使用：不為了算數量而 readText 每個 spec.md，
     * 單一無法讀取的 spec.md 也不會 throw 而中斷整份列表列舉。
     */
    private fun hasSpecsTree(changeDir: File): Boolean {
        val specsDir = File(changeDir, "specs")
        if (!specsDir.isDirectory) return false
        return specsDir.listFiles()
            ?.any { it.isDirectory && !it.name.startsWith(".") && File(it, "spec.md").exists() }
            ?: false
    }

    /** 配置一個尚未被占用的 artifact id：base 若已被占用，以 base-2 / base-3 … 遞增直到未占用，
     *  並登記進 used。用於化解 root 檔（如 specs.md）與 specs delta tree 對 "specs" id 的碰撞。 */
    private fun uniqueId(base: String, used: MutableSet<String>): String {
        var id = base
        var n = 2
        while (used.contains(id)) id = "$base-${n++}"
        used.add(id)
        return id
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

    /** artifact 數量（root *.md + specs/ 非空各算一個），不讀內容。
     *  changeDir 不存在時 rootMarkdownFiles 回空、hasSpecsTree 回 false，自然得 0，無需另設守衛。 */
    fun count(changeDir: File): Int {
        var n = rootMarkdownFiles(changeDir).size
        if (hasSpecsTree(changeDir)) n += 1
        return n
    }

    /**
     * 動態探索 change 目錄的 artifacts，依 mtime 由新到舊排序：root 檔案取自身 mtime、
     * specs 取其 delta 檔案中最新的 mtime。只有兩個 artifact 的 mtime「完全相同」時（例如同秒寫入）
     * 才以 DEFAULT_ORDER 優先、其餘字母序作穩定 tiebreak。注意 git clone/checkout 通常寫出各異的
     * mtime，故此預設模式不保證剛簽出的 repo 呈現 proposal→design→… 敘事序（需 authored 順序請用
     * 前端的 Schema order / A–Z）。id 固定保留 "specs" 給 delta tree。
     */
    fun discover(changeDir: File): List<ChangeArtifact> {
        // changeDir 不存在時 readSpecsTree / rootMarkdownFiles 各自回空，built 為空 → 回空清單
        val built = LinkedHashMap<String, ChangeArtifact>()
        val mtimes = HashMap<String, Long>()
        val used = HashSet<String>()

        // 保留 "specs" id 給 delta tree：先探得 specs/ 是否非空，若是則佔住 id，讓同名的 root
        // specs.md 走 uniqueId 取得不碰撞的 id（如 specs-2），避免其內容被 tree 覆蓋而遺失。
        val specs = readSpecsTree(changeDir)
        val hasSpecs = specs.isNotEmpty()
        if (hasSpecs) used.add("specs")

        for (file in rootMarkdownFiles(changeDir)) {
            val stem = file.name.replace(Regex("""\.md$""", RegexOption.IGNORE_CASE), "")
            val id = uniqueId(stem, used)
            val content = file.readText()
            // mtime 一律以「配置到的 id」為 key，與最終排序讀取的 key 對齊（碰撞改 id 後仍能正確取到）
            mtimes[id] = file.lastModified()
            if (file.name.equals("tasks.md", ignoreCase = true)) {
                built[id] = ChangeArtifact(id = id, title = humanize(stem), kind = "tasks", tasks = TaskParser.parse(content))
            } else {
                built[id] = ChangeArtifact(id = id, title = humanize(stem), kind = "markdown", content = content)
            }
        }

        if (hasSpecs) {
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
