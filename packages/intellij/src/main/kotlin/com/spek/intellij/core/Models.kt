package com.spek.intellij.core

import kotlinx.serialization.Serializable

@Serializable
data class TaskItem(
    val text: String,
    val completed: Boolean,
)

@Serializable
data class TaskSection(
    val title: String,
    val tasks: List<TaskItem>,
)

@Serializable
data class TaskStats(
    val total: Int,
    val completed: Int,
)

@Serializable
data class ParsedTasks(
    val total: Int,
    val completed: Int,
    val sections: List<TaskSection>,
)

@Serializable
data class SpecInfo(
    val topic: String,
    val path: String,
    val historyCount: Int,
)

@Serializable
data class HistoryEntry(
    val slug: String,
    val date: String?,
    val timestamp: String?,
    val description: String,
    val status: String, // "active" | "archived"
)

@Serializable
data class SpecDetail(
    val topic: String,
    val content: String,
    val relatedChanges: List<String>,
    val history: List<HistoryEntry>,
)

@Serializable
data class ChangeInfo(
    val slug: String,
    val date: String?,
    val timestamp: String?,
    val createdDate: String? = null,
    val archivedDate: String? = null,
    val description: String,
    val status: String, // "active" | "archived"
    val hasProposal: Boolean,
    val hasDesign: Boolean,
    val hasTasks: Boolean,
    val hasSpecs: Boolean,
    val artifactCount: Int,
    val schema: String?,
    val taskStats: TaskStats?,
)

// 動態探索到的單一 change artifact；kind 為 "markdown" | "tasks" | "specs"
@Serializable
data class ChangeArtifact(
    val id: String,
    val title: String,
    val kind: String,
    val content: String? = null,
    val tasks: ParsedTasks? = null,
    val specs: List<ChangeSpec>? = null,
)

@Serializable
data class ChangeDetail(
    val slug: String,
    val status: String,
    val schema: String?,
    val artifacts: List<ChangeArtifact>,
    /** schema 權威順序（artifact id 清單）；CLI 不可用 / archived 時為 null */
    val schemaOrder: List<String>? = null,
    // Timeline 生命週期：createdDate 供 change-detail banner，archivedDate 由 archive/<slug> 判定
    val createdDate: String? = null,
    val archivedDate: String? = null,
    val metadata: Map<String, String>?,
)

@Serializable
data class ChangeSpec(
    val topic: String,
    val content: String,
)

@Serializable
data class ChangesData(
    val active: List<ChangeInfo>,
    val archived: List<ChangeInfo>,
)

@Serializable
data class OverviewData(
    val specsCount: Int,
    val changesCount: ChangesCount,
    val taskStats: TaskStats,
)

@Serializable
data class ChangesCount(
    val active: Int,
    val archived: Int,
)

@Serializable
data class SearchResult(
    val type: String, // "spec" | "change"
    val title: String,
    val slug: String? = null,
    val topic: String? = null,
    val context: String,
    val file: String? = null,
)

@Serializable
data class BrowseEntry(
    val name: String,
    val type: String, // "directory" | "file"
    val path: String,
)

@Serializable
data class BrowseData(
    val path: String,
    val entries: List<BrowseEntry>,
)

@Serializable
data class DetectData(
    val hasOpenSpec: Boolean,
    val schema: String? = null,
)

@Serializable
data class SpecVersionContent(
    val content: String,
)

@Serializable
data class GraphNode(
    val id: String,
    val type: String, // "spec" | "change"
    val label: String,
    val date: String? = null,
    val status: String? = null,
    val historyCount: Int? = null,
    val specCount: Int? = null,
)

@Serializable
data class GraphEdge(
    val source: String,
    val target: String,
)

@Serializable
data class GraphData(
    val nodes: List<GraphNode>,
    val edges: List<GraphEdge>,
)
