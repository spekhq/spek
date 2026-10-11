package com.spek.intellij.tree

import com.spek.intellij.core.OpenSpecScanner
import com.spek.intellij.core.SpecInfo
import java.util.TreeMap
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
        addSpecFolders(specsRoot, scan.specs)
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

    private class Folder(val name: String, val path: String) {
        var spec: SpecInfo? = null
        // A TreeMap orders by String.compareTo — UTF-16 code units, per segment, as the web and VS Code
        // trees do. Ordering by full topic instead would put `a-b` between `a` and its child `a/c`.
        val children = TreeMap<String, Folder>()
    }

    /** Group the flat spec list into one folder per topic segment, under [parent]. */
    internal fun addSpecFolders(parent: DefaultMutableTreeNode, specs: List<SpecInfo>) {
        val roots = TreeMap<String, Folder>()
        for (spec in specs) {
            var siblings = roots
            var prefix = ""
            var folder: Folder? = null
            for (segment in spec.topic.split('/')) {
                prefix = if (prefix.isEmpty()) segment else "$prefix/$segment"
                val path = prefix
                folder = siblings.getOrPut(segment) { Folder(segment, path) }
                siblings = folder.children
            }
            folder?.spec = spec
        }
        fun attach(to: DefaultMutableTreeNode, folders: Collection<Folder>) {
            for (f in folders) {
                val node = DefaultMutableTreeNode(SpekTreeNode.SpecFolder(f.name, f.path, f.spec))
                attach(node, f.children.values)
                to.add(node)
            }
        }
        attach(parent, roots.values)
    }
}
