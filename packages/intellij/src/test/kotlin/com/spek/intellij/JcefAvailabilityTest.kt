package com.spek.intellij

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class JcefAvailabilityTest {

    /**
     * Regression test for issue #24: once 2026.2 moved JCEF into its own content module, a plugin that does not
     * declare the dependency gets a NoClassDefFoundError at the JBCefApp.isSupported() call. It is an Error, not an
     * Exception, so the original guard could not catch it — the fallback was never reached and Tool Window
     * construction failed.
     */
    @Test
    fun probeThrowingNoClassDefFoundErrorIsTreatedAsUnavailable() {
        assertFalse(
            JcefAvailability.isAvailable { throw NoClassDefFoundError("com/intellij/ui/jcef/JBCefApp") },
            "an unresolvable JCEF class must degrade, never let the Error escape",
        )
    }

    @Test
    fun probeThrowingLinkageErrorIsTreatedAsUnavailable() {
        assertFalse(
            JcefAvailability.isAvailable { throw NoSuchMethodError("JBCefApp.isSupported()") },
            "any LinkageError means the question cannot be answered, so treat JCEF as unavailable",
        )
    }

    @Test
    fun probeThrowingExceptionIsTreatedAsUnavailable() {
        assertFalse(
            JcefAvailability.isAvailable { throw IllegalStateException("JCEF failed to initialize") },
            "an initialization failure must degrade too",
        )
    }

    @Test
    fun probeReturningFalseIsTreatedAsUnavailable() {
        assertFalse(JcefAvailability.isAvailable { false })
    }

    @Test
    fun probeReturningTrueIsTreatedAsAvailable() {
        assertTrue(JcefAvailability.isAvailable { true })
    }
}
