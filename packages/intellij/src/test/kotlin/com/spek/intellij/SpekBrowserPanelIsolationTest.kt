package com.spek.intellij

import java.io.File
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Enforces the constraint that JCEF types exist only in JcefWebviewHost / JcefAvailability.
 *
 * It scans the compiled constant pool because nothing else can catch this: a JCEF type leaking back into
 * SpekBrowserPanel breaks no compile and turns no behavioural test red — it only explodes on an IDE that lacks the
 * JCEF modules, and no such IDE runs in CI.
 */
class SpekBrowserPanelIsolationTest {

    @Test
    fun panelClassesReferenceNoJcefOrCefTypes() {
        // Read the Kotlin compiler output directly instead of deriving it from the classpath: the test classpath
        // holds an instrumented jar whose URL is non-hierarchical, and what we want to check is how our own sources
        // compiled. Gradle's Test task defaults its workingDir to the project directory.
        val dir = File("build/classes/kotlin/main/com/spek/intellij")
        assertTrue(dir.isDirectory, "compiler output directory not found: ${dir.absolutePath}")

        // Cover lambdas and inner classes (SpekBrowserPanel$xxx.class) too — a reference could hide in one of those
        val classFiles = dir.listFiles { f ->
            f.name.startsWith("SpekBrowserPanel") && f.name.endsWith(".class")
        }.orEmpty()
        assertTrue(classFiles.isNotEmpty(), "no SpekBrowserPanel class files found in ${dir.absolutePath}")

        for (file in classFiles) {
            // Type names in the constant pool are UTF-8; reading the bytes as latin-1 is enough for a substring check
            val bytes = String(file.readBytes(), Charsets.ISO_8859_1)
            assertFalse(
                bytes.contains("com/intellij/ui/jcef"),
                "${file.name} references com.intellij.ui.jcef — that package must appear only in JcefWebviewHost",
            )
            assertFalse(
                bytes.contains("org/cef"),
                "${file.name} references org.cef — it comes from a separate content module and likewise belongs " +
                    "only in JcefWebviewHost",
            )
        }
    }
}
