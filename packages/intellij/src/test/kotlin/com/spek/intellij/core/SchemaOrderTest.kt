package com.spek.intellij.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SchemaOrderTest {

    // --- parseOrderFromStatus ---

    @Test
    fun parseExtractsOrderedRefs() {
        val refs = SchemaOrder.parseOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["brainstorm", "proposal", "specs"] },
              "artifactPaths": {
                "brainstorm": { "outputPath": "brainstorm.md" },
                "proposal": { "outputPath": "proposal.md" },
                "specs": { "outputPath": "specs/**/*.md" }
              }
            }
            """.trimIndent(),
        )
        assertEquals(
            listOf(
                SchemaArtifactRef("brainstorm", "brainstorm.md"),
                SchemaArtifactRef("proposal", "proposal.md"),
                SchemaArtifactRef("specs", "specs/**/*.md"),
            ),
            refs,
        )
    }

    @Test
    fun parseSkipsIdsWithoutOutputPath() {
        val refs = SchemaOrder.parseOrderFromStatus(
            """
            {
              "actionContext": { "planningArtifacts": ["proposal", "ghost"] },
              "artifactPaths": { "proposal": { "outputPath": "proposal.md" } }
            }
            """.trimIndent(),
        )
        assertEquals(listOf(SchemaArtifactRef("proposal", "proposal.md")), refs)
    }

    @Test
    fun parseReturnsNullForMalformed() {
        assertNull(SchemaOrder.parseOrderFromStatus("not json"))
        assertNull(SchemaOrder.parseOrderFromStatus("{}"))
        assertNull(
            SchemaOrder.parseOrderFromStatus(
                """{ "actionContext": { "planningArtifacts": [] }, "artifactPaths": {} }""",
            ),
        )
    }

    // --- resolveSchemaOrder ---

    private fun refs(vararg pairs: Pair<String, String>) =
        pairs.map { SchemaArtifactRef(it.first, it.second) }

    @Test
    fun resolveMapsLiteralFilenamesPreservingOrder() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("brainstorm" to "brainstorm.md", "proposal" to "proposal.md", "plan" to "plan.md"),
            listOf("proposal", "plan", "brainstorm"),
        )
        assertEquals(listOf("brainstorm", "proposal", "plan"), order)
    }

    @Test
    fun resolveSpecsGlobMapsToSpecs() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("specs" to "specs/**/*.md", "proposal" to "proposal.md"),
            listOf("proposal", "specs"),
        )
        assertEquals(listOf("specs", "proposal"), order)
    }

    @Test
    fun resolveLiteralSpecPathMapsToSpecs() {
        val order = SchemaOrder.resolveSchemaOrder(refs("specs" to "specs/foo/spec.md"), listOf("specs"))
        assertEquals(listOf("specs"), order)
    }

    @Test
    fun resolveNonSpecsGlobDoesNotMap() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("anything" to "*.md"), listOf("proposal", "specs")))
    }

    @Test
    fun resolveSpecMdOutsideSpecsPathDoesNotMap() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("weird" to "docs/spec.md"), listOf("specs")))
    }

    @Test
    fun resolveTrimsOutputPath() {
        val order = SchemaOrder.resolveSchemaOrder(refs("design" to "  design.md  "), listOf("design"))
        assertEquals(listOf("design"), order)
    }

    @Test
    fun resolveSkipsUnknownIds() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("ghost" to "ghost.md", "proposal" to "proposal.md"),
            listOf("proposal"),
        )
        assertEquals(listOf("proposal"), order)
    }

    @Test
    fun resolveDeduplicates() {
        val order = SchemaOrder.resolveSchemaOrder(
            refs("specs" to "specs/**/*.md", "specs-again" to "specs/foo/spec.md"),
            listOf("specs"),
        )
        assertEquals(listOf("specs"), order)
    }

    @Test
    fun resolveNullRefsYieldsNull() {
        assertNull(SchemaOrder.resolveSchemaOrder(null, listOf("proposal")))
    }

    @Test
    fun resolveNoMatchesYieldsNull() {
        assertNull(SchemaOrder.resolveSchemaOrder(refs("ghost" to "ghost.md"), listOf("proposal")))
    }
}
