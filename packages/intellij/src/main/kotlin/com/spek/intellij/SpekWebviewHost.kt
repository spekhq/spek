package com.spek.intellij

import com.intellij.openapi.Disposable
import javax.swing.JComponent

/**
 * Abstraction over the Tool Window's embedded browser.
 *
 * This interface deliberately names no `com.intellij.ui.jcef.*` / `org.cef.*` type: its implementation
 * [JcefWebviewHost] is the only class that touches those packages, and it is constructed only once
 * [JcefAvailability.isAvailable] has passed. When the platform relocates those packages into separate content
 * modules — as 2026.2 did, see issue #24 — the blast radius stays in one known place instead of spreading through
 * the Tool Window panel.
 */
interface SpekWebviewHost : Disposable {
    val component: JComponent

    fun loadUrl(url: String)

    fun executeJavaScript(script: String)
}
