package com.spek.intellij

import com.intellij.openapi.diagnostic.Logger
import com.intellij.ui.jcef.JBCefApp

/**
 * Decides whether this IDE can use JCEF.
 *
 * Two constraints must not be relaxed:
 *
 * 1. `JBCefApp` may appear only inside a method body — never in a field type or a signature. That is what makes it
 *    resolve when the instruction actually executes, which is the only point at which the failure is catchable.
 * 2. The catch must be `Throwable`, not `Exception`. Since 2026.2 moved JCEF into its own content module, a plugin
 *    that does not declare the dependency gets a `NoClassDefFoundError` out of `isSupported()` — an `Error`, which
 *    `catch (e: Exception)` does not catch. That is why the fallback branch was unreachable and Tool Window
 *    construction failed outright (issue #24).
 *
 * Being unable to ask is itself an answer: if the probe cannot run, treat JCEF as unavailable and fall back to the
 * external browser.
 */
object JcefAvailability {
    private val log = Logger.getInstance(JcefAvailability::class.java)

    /**
     * [probe] is injectable purely so a unit test can feed it one that throws [NoClassDefFoundError] and guard the
     * issue #24 regression without needing an IDE. Production callers always use the default.
     */
    fun isAvailable(probe: () -> Boolean = { JBCefApp.isSupported() }): Boolean =
        try {
            probe()
        } catch (t: Throwable) {
            log.warn(
                "JCEF is unavailable in this IDE; spek will fall back to the external browser. " +
                    "On 2026.2+ this usually means the plugin could not reach the com.intellij.modules.jcef module.",
                t,
            )
            false
        }
}
