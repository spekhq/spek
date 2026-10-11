package com.spek.intellij.core

import java.io.File

/**
 * Aligned with @spekjs/core's artifact-files.ts. The filesystem view of one change directory: which files
 * are artifacts, their kinds, their names, and their mtimes. Everything here reads directory entries and
 * stats only. It does not read file content. ArtifactDiscovery.discover builds the ChangeArtifact objects
 * on top of this list.
 */
object ArtifactFiles {

    // internal, not private: WatchPolling builds its snapshot's watched-extension set (`.md` + these)
    // from this one source. A new data extension then cannot land here and be silently ignored there.
    internal val DATA_EXTENSIONS = listOf(".yaml", ".yml", ".json")

    // internal for the same reason as DATA_EXTENSIONS: WatchPolling builds its watched-extension set from
    // these lists rather than a third copy. A diagram is its own kind, not another data extension — `data`
    // means "show this file's text", `diagram` means "show what this file describes".
    internal val DIAGRAM_EXTENSIONS = listOf(".mmd", ".mermaid")

    /** The kind of a root-level artifact file. specs is not here: it is a tree, not a root file. */
    enum class RootKind { TASKS, MARKDOWN, DATA, DIAGRAM }

    private fun isTasksName(n: String) = n == "tasks.md"
    private fun isMarkdownName(n: String) = n.endsWith(".md")
    private fun isDataName(n: String) = DATA_EXTENSIONS.any { n.endsWith(it) }
    private fun isDiagramName(n: String) = DIAGRAM_EXTENSIONS.any { n.endsWith(it) }

    /**
     * The one classifier for root files. It returns the artifact kind of a root filename, or null if the
     * file is not an artifact. count, search, and discover all go through it, so a new root kind cannot
     * slip past one of them.
     */
    private fun rootKind(nameLower: String): RootKind? = when {
        isTasksName(nameLower) -> RootKind.TASKS
        isMarkdownName(nameLower) -> RootKind.MARKDOWN
        isDataName(nameLower) -> RootKind.DATA
        isDiagramName(nameLower) -> RootKind.DIAGRAM
        else -> null
    }

    /**
     * The root artifact files with their kinds, in id-dedup precedence: markdown and tasks first, then
     * the extension-keeping kinds (data and diagram). This order lets spec.md keep the id "spec" and
     * pushes spec.json to spec-2. discover builds
     * from this list. The display order is a separate mtime sort in discover. It does one directory read
     * and partitions the entries by kind.
     */
    fun rootArtifacts(changeDir: File): List<Pair<File, RootKind>> {
        // Carry (file, kind) through the partition so the kind is computed once, not recomputed behind a
        // !! after the sort.
        val md = mutableListOf<Pair<File, RootKind>>()
        val data = mutableListOf<Pair<File, RootKind>>()
        changeDir.listFiles()?.forEach { f ->
            if (!f.isFile || f.name.startsWith(".")) return@forEach
            when (val kind = rootKind(f.name.lowercase())) {
                // data and diagram share the second bucket: both keep their extension in the title, and
                // both yield the bare stem to a markdown file of the same name.
                RootKind.DATA, RootKind.DIAGRAM -> data.add(f to kind)
                RootKind.TASKS, RootKind.MARKDOWN -> md.add(f to kind)
                null -> {}
            }
        }
        md.sortBy { it.first.name }
        data.sortBy { it.first.name }
        return md + data
    }

    /**
     * The specs/ delta tree as a (topic, file) list, at any depth, sorted by topic in code-unit order. It
     * reads directory entries only. hasSpecsTree, specsMtime, and the spec content read in
     * ArtifactDiscovery.discover all derive from the one walker in SpecFiles.
     */
    fun listSpecFiles(changeDir: File): List<Pair<String, File>> =
        SpecFiles.discover(File(changeDir, "specs")).map { it.topic to it.file }

    /** True if specs/ holds at least one spec. This is the changes-list hot path (count, called per
     *  change during a scan), so it stops at the first hit rather than building the full list. */
    private fun hasSpecsTree(changeDir: File): Boolean = SpecFiles.hasAny(File(changeDir, "specs"))

    /** The sort time of the specs artifact: the newest mtime of every spec.md file (0 if none). */
    fun specsMtime(changeDir: File): Long =
        listSpecFiles(changeDir).maxOfOrNull { (_, file) -> file.lastModified() } ?: 0L

    /**
     * The root files that count as a searchable artifact (markdown, tasks, data, and diagram), sorted by
     * name. A diagram is indexed as the text it holds, not the picture drawn from it. The
     * SearchService index shares this list, so any tab that comes from a root file is indexed. The specs
     * delta tree is not here: its content does not go into search.
     */
    fun artifactFiles(changeDir: File): List<File> =
        rootArtifacts(changeDir).map { it.first }.sortedBy { it.name }

    /** The artifact count (the root artifact files, plus 1 for a non-empty specs tree). It reads no
     *  content, and returns 0 for a missing changeDir. */
    fun count(changeDir: File): Int =
        rootArtifacts(changeDir).size + if (hasSpecsTree(changeDir)) 1 else 0
}
