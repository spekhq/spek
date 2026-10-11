package com.spek.intellij.core

import java.io.File

/**
 * The filesystem side of the search corpus: one document per spec, one per change root artifact file.
 *
 * Mirrors `packages/core/src/search-documents.ts`. The rule itself is in [SearchRule]; this only decides
 * which documents exist. The change's delta `specs/` tree is not indexed: its content is the delta of a
 * main spec that is itself indexed, so indexing it would list the same text under two names.
 */
object SearchService {

    fun search(projectPath: String, query: String): List<SearchResult> =
        SearchRule.search(collectDocuments(projectPath), query)

    /** Directory entries, minus dot entries. A missing directory reads as empty. */
    private fun entries(dir: File): List<File> =
        dir.listFiles()?.filter { !it.name.startsWith(".") }?.sortedBy { it.name } ?: emptyList()

    fun collectDocuments(projectPath: String): List<SearchRule.Document> {
        val base = File(projectPath, "openspec")
        val documents = mutableListOf<SearchRule.Document>()

        for ((topic, specFile) in SpecFiles.discover(File(base, "specs"))) {
            documents.add(
                SearchRule.Document(
                    type = "spec",
                    name = topic,
                    file = "spec.md",
                    text = specFile.readText(),
                )
            )
        }

        val changesDir = File(base, "changes")
        collectChanges(changesDir, "active", documents)
        collectChanges(File(changesDir, "archive"), "archived", documents)

        return documents
    }

    private fun collectChanges(
        dir: File,
        status: String,
        out: MutableList<SearchRule.Document>,
    ) {
        for (changeDir in entries(dir)) {
            if (!changeDir.isDirectory || changeDir.name == "archive") continue
            // rootArtifacts order — markdown and tasks before data — so a change matched by name alone is
            // previewed from prose rather than from raw YAML.
            for ((file, _) in ArtifactFiles.rootArtifacts(changeDir)) {
                out.add(
                    SearchRule.Document(
                        type = "change",
                        name = changeDir.name,
                        file = file.name,
                        text = file.readText(),
                        status = status,
                    )
                )
            }
        }
    }
}
