package com.spek.intellij.tree

import com.spek.intellij.core.SpecInfo
import java.io.File
import javax.swing.tree.DefaultMutableTreeNode
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SpekTreeModelTest {

    private fun spec(topic: String) = SpecInfo(topic, "/r/$topic/spec.md", 0)

    private fun folders(node: DefaultMutableTreeNode): List<SpekTreeNode.SpecFolder> =
        node.children().toList().map { (it as DefaultMutableTreeNode).userObject as SpekTreeNode.SpecFolder }

    private fun child(node: DefaultMutableTreeNode, name: String): DefaultMutableTreeNode =
        node.children().toList().map { it as DefaultMutableTreeNode }
            .single { (it.userObject as SpekTreeNode.SpecFolder).name == name }

    private fun build(vararg topics: String): DefaultMutableTreeNode =
        DefaultMutableTreeNode().also { SpekTreeModel.addSpecFolders(it, topics.map(::spec)) }

    @Test
    fun `siblings sort per segment by code unit`() {
        val root = build("ab", "a/c", "a-b", "a")
        assertEquals(listOf("a", "a-b", "ab"), folders(root).map { it.name })
        assertEquals(listOf("a/c"), folders(child(root, "a")).map { it.path })
    }

    @Test
    fun `a spec-bearing parent opens and expands, a grouping folder opens nothing`() {
        val root = build("contracts/pagination", "contracts/pagination/streaming-search")
        val contracts = folders(root).single()
        assertNull(contracts.spec)
        assertNull(navigationPath(contracts))
        val pagination = child(child(root, "contracts"), "pagination")
        val paginationNode = pagination.userObject as SpekTreeNode.SpecFolder
        assertEquals("/specs/contracts/pagination", navigationPath(paginationNode))
        val leaf = folders(pagination).single()
        assertEquals("streaming-search", leaf.name)
        assertEquals("contracts/pagination/streaming-search", leaf.path)
        assertEquals("/specs/contracts/pagination/streaming-search", navigationPath(leaf))
    }

    @Test
    fun `duplicate basenames navigate to their own full topic`() {
        val root = build("contracts/streaming-search", "guides/streaming-search")
        val paths = folders(root).map { navigationPath(folders(child(root, it.name)).single()) }
        assertEquals(listOf("/specs/contracts/streaming-search", "/specs/guides/streaming-search"), paths)
    }

    @Test
    fun `the fixture repository builds the nested Specs root`() {
        val fixture = File(System.getProperty("spek.nestedSpecsFixture")!!)
        val model = SpekTreeModel.build(fixture.absolutePath)
        val specsRoot = (model.root as DefaultMutableTreeNode).getChildAt(0) as DefaultMutableTreeNode
        assertEquals(listOf("auth", "contracts", "guides"), folders(specsRoot).map { it.name })
    }
}
