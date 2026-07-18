package com.spek.intellij.tree

import com.spek.intellij.core.ChangeInfo
import com.spek.intellij.core.SpecInfo

sealed class SpekTreeNode(val label: String) {
    class SpecsRoot(val specs: List<SpecInfo>) : SpekTreeNode("Specs")
    class SpecItem(val spec: SpecInfo) : SpekTreeNode(spec.topic)
    class ChangesRoot(
        val activeChanges: List<ChangeInfo>,
        val archivedChanges: List<ChangeInfo>,
    ) : SpekTreeNode("Changes")
    class ChangeGroup(label: String, val changes: List<ChangeInfo>) : SpekTreeNode(label)
    class ChangeItem(val change: ChangeInfo) : SpekTreeNode(change.slug)
}
