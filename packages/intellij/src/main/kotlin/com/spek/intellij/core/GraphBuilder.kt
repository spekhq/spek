package com.spek.intellij.core

import java.io.File

object GraphBuilder {

    fun build(projectPath: String): GraphData {
        val base = File(projectPath, "openspec")
        val specsDir = File(base, "specs")
        val changesDir = File(base, "changes")
        val archiveDir = File(changesDir, "archive")

        // 收集 spec topics
        val specTopics = specsDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") && File(it, "spec.md").exists() }
            ?.map { it.name }
            ?: emptyList()

        // 收集 change dirs
        data class ChangeDirInfo(val slug: String, val dir: File, val status: String)
        val changeDirs = mutableListOf<ChangeDirInfo>()

        changesDir.listFiles()
            ?.filter { it.isDirectory && it.name != "archive" && !it.name.startsWith(".") }
            ?.forEach { changeDirs.add(ChangeDirInfo(it.name, it, "active")) }

        archiveDir.listFiles()
            ?.filter { it.isDirectory && !it.name.startsWith(".") }
            ?.forEach { changeDirs.add(ChangeDirInfo(it.name, it, "archived")) }

        // 建立 edges
        val edges = mutableListOf<GraphEdge>()
        val changeSpecCounts = mutableMapOf<String, Int>()
        val specHistoryCounts = mutableMapOf<String, Int>()

        for ((slug, dir, _) in changeDirs) {
            val changeSpecsDir = File(dir, "specs")
            if (!changeSpecsDir.isDirectory) continue

            var specCount = 0
            changeSpecsDir.listFiles()
                ?.filter { it.isDirectory && !it.name.startsWith(".") }
                ?.forEach { topicDir ->
                    if (File(topicDir, "spec.md").exists()) {
                        edges.add(GraphEdge("change:$slug", "spec:${topicDir.name}"))
                        specCount++
                        specHistoryCounts[topicDir.name] =
                            (specHistoryCounts[topicDir.name] ?: 0) + 1
                    }
                }
            if (specCount > 0) {
                changeSpecCounts[slug] = specCount
            }
        }

        // 建立 nodes
        val nodes = mutableListOf<GraphNode>()

        for (topic in specTopics) {
            nodes.add(
                GraphNode(
                    id = "spec:$topic",
                    type = "spec",
                    label = topic,
                    historyCount = specHistoryCounts[topic] ?: 0,
                )
            )
        }

        for ((slug, _, status) in changeDirs) {
            val specCount = changeSpecCounts[slug] ?: continue
            val (date, description) = parseSlug(slug)
            nodes.add(
                GraphNode(
                    id = "change:$slug",
                    type = "change",
                    label = description,
                    date = date,
                    status = status,
                    specCount = specCount,
                )
            )
        }

        return GraphData(nodes, edges)
    }
}
