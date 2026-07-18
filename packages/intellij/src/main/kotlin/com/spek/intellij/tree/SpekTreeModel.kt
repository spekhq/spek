package com.spek.intellij.tree

import com.spek.intellij.core.OpenSpecScanner
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel

object SpekTreeModel {

    /** 空 model，供樹狀面板在隱藏狀態下建立時使用，避免不必要的磁碟掃描。 */
    fun empty(): DefaultTreeModel = DefaultTreeModel(DefaultMutableTreeNode("spek"))

    fun build(projectPath: String): DefaultTreeModel {
        val root = DefaultMutableTreeNode("spek")
        val scan = OpenSpecScanner.scan(projectPath)

        // Specs root
        val specsRoot = DefaultMutableTreeNode(SpekTreeNode.SpecsRoot(scan.specs))
        for (spec in scan.specs) {
            specsRoot.add(DefaultMutableTreeNode(SpekTreeNode.SpecItem(spec)))
        }
        root.add(specsRoot)

        // Changes root
        val changesRoot = DefaultMutableTreeNode(
            SpekTreeNode.ChangesRoot(scan.activeChanges, scan.archivedChanges),
        )
        if (scan.activeChanges.isNotEmpty()) {
            val activeGroup = DefaultMutableTreeNode(
                SpekTreeNode.ChangeGroup("Active", scan.activeChanges),
            )
            for (change in scan.activeChanges) {
                activeGroup.add(DefaultMutableTreeNode(SpekTreeNode.ChangeItem(change)))
            }
            changesRoot.add(activeGroup)
        }
        if (scan.archivedChanges.isNotEmpty()) {
            val archivedGroup = DefaultMutableTreeNode(
                SpekTreeNode.ChangeGroup("Archived", scan.archivedChanges),
            )
            for (change in scan.archivedChanges) {
                archivedGroup.add(DefaultMutableTreeNode(SpekTreeNode.ChangeItem(change)))
            }
            changesRoot.add(archivedGroup)
        }
        root.add(changesRoot)

        return DefaultTreeModel(root)
    }
}
