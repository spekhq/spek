package com.spek.intellij.core

import org.junit.jupiter.api.Assumptions.assumeFalse
import java.io.File
import java.nio.file.Files
import java.util.concurrent.TimeUnit
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Issue #73: an IDE launched from the macOS Dock has launchd's minimal `PATH`, while the CLI — and the
 * `node` its shebang asks for — live in a directory only the login shell adds. These tests stand that
 * up with a directory the JVM's own `PATH` has never heard of.
 */
class OpenspecCliTest {
    private fun isWindows() = System.getProperty("os.name").orEmpty().lowercase().contains("win")

    private fun executable(dir: File, name: String, body: String): File =
        File(dir, name).apply {
            writeText(body)
            setExecutable(true)
        }

    /** A shell-only bin directory holding a fake `node` and an `openspec` that runs on it, as npm installs it. */
    private fun shellOnlyBin(): File {
        val bin = Files.createTempDirectory("spek-shell-bin").toFile()
        // Stands in for node: runs the script it is handed with sh.
        executable(bin, "fakenode", "#!/bin/sh\nexec /bin/sh \"$@\"\n")
        executable(bin, "openspec", "#!/usr/bin/env fakenode\necho \"openspec $*\"\n")
        return bin
    }

    @Test
    fun `finds the CLI and its interpreter on the shell PATH, not the JVM's`() {
        assumeFalse(isWindows(), "the fixture is a POSIX shebang script")
        val bin = shellOnlyBin()
        try {
            val env = mapOf("PATH" to "${bin.absolutePath}${File.pathSeparator}/usr/bin${File.pathSeparator}/bin")
            val proc = OpenspecCli.processBuilder(listOf("schemas", "--json"), bin.absolutePath, env).start()
            val out = proc.inputStream.bufferedReader().use { it.readText() }
            proc.waitFor(10, TimeUnit.SECONDS)

            assertEquals(0, proc.exitValue())
            assertEquals("openspec schemas --json", out.trim())
        } finally {
            bin.deleteRecursively()
        }
    }

    @Test
    fun `an absent CLI still fails to start`() {
        assumeFalse(isWindows(), "POSIX directory layout")
        val empty = Files.createTempDirectory("spek-empty-bin").toFile()
        try {
            val pb = OpenspecCli.processBuilder(emptyList(), empty.absolutePath, mapOf("PATH" to empty.absolutePath))

            // Kept as the bare name, so the JVM's own lookup decides: where that finds nothing, start()
            // throws and run() reports StartFailed, as it always did. (Not started here — the machine
            // running the tests may well have a real openspec on its own PATH.)
            assertEquals(listOf("openspec"), pb.command())
        } finally {
            empty.deleteRecursively()
        }
    }
}
