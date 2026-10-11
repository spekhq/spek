package com.spek.intellij.tree

import javax.swing.JTree
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.TreePath
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ExpandRootsTest {

    private fun node(name: String, vararg children: DefaultMutableTreeNode) =
        DefaultMutableTreeNode(name).apply { children.forEach(::add) }

    @Test
    fun `both roots open, and nothing below them`() {
        val a = node("a", node("a1"))
        val b = node("b", node("b1"))
        val specs = node("Specs", a, b)
        val active = node("Active", node("add-x"))
        val changes = node("Changes", active)
        val root = node("spek", specs, changes)
        val tree = JTree(DefaultTreeModel(root)).apply { isRootVisible = false }

        expandRoots(tree)

        assertTrue(tree.isExpanded(TreePath(arrayOf(root, specs))), "Specs")
        assertTrue(tree.isExpanded(TreePath(arrayOf(root, changes))), "Changes")
        assertFalse(tree.isExpanded(TreePath(arrayOf(root, specs, a))), "a/")
        assertFalse(tree.isExpanded(TreePath(arrayOf(root, specs, b))), "b/")
        assertFalse(tree.isExpanded(TreePath(arrayOf(root, changes, active))), "Active")
    }
}
