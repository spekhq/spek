package com.spek.intellij.tree

import com.intellij.icons.AllIcons
import java.awt.Component
import javax.swing.JTree
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeCellRenderer

class SpekTreeCellRenderer : DefaultTreeCellRenderer() {

    override fun getTreeCellRendererComponent(
        tree: JTree,
        value: Any?,
        sel: Boolean,
        expanded: Boolean,
        leaf: Boolean,
        row: Int,
        hasFocus: Boolean,
    ): Component {
        super.getTreeCellRendererComponent(tree, value, sel, expanded, leaf, row, hasFocus)
        // One renderer paints every row, so a tooltip set for one row would otherwise stay on the next.
        toolTipText = null

        val node = (value as? DefaultMutableTreeNode)?.userObject as? SpekTreeNode ?: return this

        when (node) {
            is SpekTreeNode.SpecsRoot -> {
                text = "Specs (${node.specs.size})"
                icon = AllIcons.Nodes.Folder
            }
            is SpekTreeNode.SpecFolder -> {
                text = node.name
                toolTipText = node.path
                icon = if (node.spec != null) AllIcons.FileTypes.Text else AllIcons.Nodes.Folder
            }
            is SpekTreeNode.ChangesRoot -> {
                val total = node.activeChanges.size + node.archivedChanges.size
                text = "Changes ($total)"
                icon = AllIcons.Nodes.Folder
            }
            is SpekTreeNode.ChangeGroup -> {
                text = "${node.label} (${node.changes.size})"
                icon = if (node.label == "Active") AllIcons.Vcs.Branch else AllIcons.Nodes.PpLib
            }
            is SpekTreeNode.ChangeItem -> {
                text = node.change.slug
                toolTipText = node.change.description
                icon = if (node.change.status == "active") AllIcons.Actions.Edit else AllIcons.Actions.Checked
            }
        }

        return this
    }
}
