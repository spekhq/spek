package com.spek.intellij.tree

import com.intellij.openapi.application.ApplicationManager
import com.intellij.ui.treeStructure.Tree
import java.awt.BorderLayout
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import javax.swing.JComponent
import javax.swing.JTree
import javax.swing.JPanel
import javax.swing.JScrollPane
import javax.swing.ToolTipManager
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.TreeModel
import javax.swing.tree.TreePath

class SpekTreePanel(
    private val projectPath: String,
    initiallyVisible: Boolean,
    private val onNavigate: (path: String) -> Unit,
) : JPanel(BorderLayout()) {

    private val tree: Tree
    private val gate = TreeRefreshGate(initiallyVisible)

    init {
        // 隱藏時不掃磁碟：以空 model 建立 Tree，等首次顯示再由閘門補刷
        val model = if (initiallyVisible) SpekTreeModel.build(projectPath) else SpekTreeModel.empty()
        tree = Tree(model)
        tree.isRootVisible = false
        tree.cellRenderer = SpekTreeCellRenderer()
        // A JTree shows its renderer's tooltip only once registered.
        ToolTipManager.sharedInstance().registerComponent(tree)

        expandRoots(tree)

        tree.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    handleDoubleClick()
                }
            }
        })

        isVisible = initiallyVisible
        add(JScrollPane(tree), BorderLayout.CENTER)
    }

    private fun handleDoubleClick() {
        val selectedNode = tree.lastSelectedPathComponent as? DefaultMutableTreeNode ?: return
        val nodeData = selectedNode.userObject as? SpekTreeNode ?: return

        // A grouping folder has no spec, so it opens nothing; the double-click only toggles it.
        val path = navigationPath(nodeData) ?: return
        onNavigate(path)
    }

    /** 由 file watcher 的 Timer 執行緒呼叫，故可見性判斷走閘門，不讀 Swing 狀態。 */
    fun refresh() {
        if (!gate.requestRefresh()) return
        rebuildModel()
    }

    /**
     * 切換樹狀面板的顯示狀態，須於 EDT 呼叫。
     *
     * 有待處理的刷新時，先在背景重建 model、完成後才顯示，避免使用者看見隱藏期間累積的過時內容。
     */
    fun setTreeVisible(visible: Boolean) {
        val needsRefresh = gate.setVisible(visible)
        if (visible && needsRefresh) {
            // 重建期間使用者可能又把樹關掉，故以閘門的當下狀態為準，別讓已隱藏的樹被 onDone 叫回來
            rebuildModel(onDone = { if (gate.isVisible()) applyVisibility(true) })
        } else {
            applyVisibility(visible)
        }
    }

    private fun applyVisibility(visible: Boolean) {
        isVisible = visible
        // Splitter 依子元件的可見性決定佈局，須讓父容器重新配置
        (parent as? JComponent)?.let {
            it.revalidate()
            it.repaint()
        }
    }

    private fun rebuildModel(onDone: (() -> Unit)? = null) {
        ApplicationManager.getApplication().executeOnPooledThread {
            val newModel = SpekTreeModel.build(projectPath)
            ApplicationManager.getApplication().invokeLater {
                replaceModel(tree, newModel)
                onDone?.invoke()
            }
        }
    }
}

/**
 * Opens the Specs and Changes roots and nothing below them. By path, not by row: expanding one row
 * shifts every row after it, so a row index taken first lands on a child of Specs instead of Changes.
 */
internal fun expandRoots(tree: JTree) {
    val root = tree.model.root
    for (i in 0 until tree.model.getChildCount(root)) {
        tree.expandPath(TreePath(arrayOf(root, tree.model.getChild(root, i))))
    }
}

/**
 * Swaps in a rebuilt model with the roots open, and every spec folder the reader had open still open.
 * A refresh rebuilds every node, so folders are matched by full topic, never by node identity.
 */
internal fun replaceModel(tree: JTree, model: TreeModel) {
    val open = specFolders(tree.model)
        .filter { (node, _) -> tree.isExpanded(TreePath(node.path)) }
        .map { (_, topic) -> topic }
        .toSet()
    tree.model = model
    expandRoots(tree)
    specFolders(model)
        .filter { (_, topic) -> topic in open }
        .forEach { (node, _) -> tree.expandPath(TreePath(node.path)) }
}

/** Every spec folder node in [model], with its full topic. */
private fun specFolders(model: TreeModel): Sequence<Pair<DefaultMutableTreeNode, String>> {
    val root = model.root as? DefaultMutableTreeNode ?: return emptySequence()
    return root.depthFirstEnumeration().asSequence()
        .map { it as DefaultMutableTreeNode }
        .mapNotNull { node -> (node.userObject as? SpekTreeNode.SpecFolder)?.let { node to it.path } }
}
