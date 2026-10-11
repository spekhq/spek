package com.spek.intellij.tree

import com.spek.intellij.core.ChangeInfo
import com.spek.intellij.core.SpecInfo
import com.spek.intellij.core.SpecTopic

sealed class SpekTreeNode(val label: String) {
    class SpecsRoot(val specs: List<SpecInfo>) : SpekTreeNode("Specs")

    /**
     * One topic folder, labelled by its own segment. With [spec] it opens that spec and may still hold
     * child topics; without one it only groups. [path] is the full topic, whether or not a spec is here.
     */
    class SpecFolder(val name: String, val path: String, val spec: SpecInfo?) : SpekTreeNode(name)
    class ChangesRoot(
        val activeChanges: List<ChangeInfo>,
        val archivedChanges: List<ChangeInfo>,
    ) : SpekTreeNode("Changes")
    class ChangeGroup(label: String, val changes: List<ChangeInfo>) : SpekTreeNode(label)
    class ChangeItem(val change: ChangeInfo) : SpekTreeNode(change.slug)
}

/** The webview route a double-click opens, or null for a node that opens nothing. */
fun navigationPath(node: SpekTreeNode): String? = when (node) {
    is SpekTreeNode.SpecFolder -> node.spec?.let { SpecTopic.route(it.topic) }
    is SpekTreeNode.ChangeItem -> "/changes/${node.change.slug}"
    else -> null
}
