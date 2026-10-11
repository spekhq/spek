package com.spek.intellij.tree

import com.spek.intellij.core.SpecInfo
import javax.swing.JTree
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.TreePath
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ReplaceModelTest {

    private fun model(vararg topics: String): DefaultTreeModel {
        val specs = DefaultMutableTreeNode(SpekTreeNode.SpecsRoot(emptyList()))
        SpekTreeModel.addSpecFolders(specs, topics.map { SpecInfo(it, "/r/$it/spec.md", 0) })
        return DefaultTreeModel(DefaultMutableTreeNode("spek").apply { add(specs) })
    }

    private fun folderPath(tree: JTree, topic: String): TreePath {
        val root = tree.model.root as DefaultMutableTreeNode
        val node = root.depthFirstEnumeration().asSequence()
            .map { it as DefaultMutableTreeNode }
            .single { (it.userObject as? SpekTreeNode.SpecFolder)?.path == topic }
        return TreePath(node.path)
    }

    @Test
    fun `a spec folder open before a refresh is open after it, and only that one`() {
        val topics = arrayOf("contracts/pagination/streaming-search", "guides/pagination/x")
        val tree = JTree(model(*topics)).apply { isRootVisible = false }
        expandRoots(tree)
        tree.expandPath(folderPath(tree, "contracts/pagination"))

        replaceModel(tree, model(*topics))

        assertTrue(tree.isExpanded(folderPath(tree, "contracts")), "contracts")
        assertTrue(tree.isExpanded(folderPath(tree, "contracts/pagination")), "contracts/pagination")
        assertFalse(tree.isExpanded(folderPath(tree, "guides")), "guides")
    }

    @Test
    fun `a folder collapsed under a collapsed parent stays closed`() {
        val topics = arrayOf("contracts/pagination/streaming-search")
        val tree = JTree(model(*topics)).apply { isRootVisible = false }
        expandRoots(tree)
        tree.expandPath(folderPath(tree, "contracts/pagination"))
        tree.collapsePath(folderPath(tree, "contracts"))

        replaceModel(tree, model(*topics))

        assertFalse(tree.isExpanded(folderPath(tree, "contracts")), "contracts")
    }
}
