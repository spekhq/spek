package com.spek.intellij

import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefBrowser
import javax.swing.JComponent

/**
 * The JCEF implementation of [SpekWebviewHost], and the only class in the plugin that mentions
 * `com.intellij.ui.jcef.*` or `org.cef.*` (`cefBrowser` belongs to the latter).
 *
 * It is constructed only after [JcefAvailability.isAvailable] reports JCEF as usable — a class that is never
 * instantiated is never loaded, so on an IDE lacking the JCEF modules these types are never resolved.
 *
 * @param isDarkMode supplied by the caller so this class needs no IDE API beyond the browser itself.
 */
class JcefWebviewHost(private val isDarkMode: () -> Boolean) : SpekWebviewHost {
    private val browser = JBCefBrowser()

    override val component: JComponent
        get() = browser.component

    init {
        Disposer.register(this, browser)
        setupThemeListener()
    }

    override fun loadUrl(url: String) {
        browser.loadURL(url)
    }

    override fun executeJavaScript(script: String) {
        browser.cefBrowser.executeJavaScript(script, "", 0)
    }

    private fun setupThemeListener() {
        val connection = ApplicationManager.getApplication().messageBus.connect(this)
        connection.subscribe(
            LafManagerListener.TOPIC,
            LafManagerListener {
                val themeClass = if (isDarkMode()) "dark" else "light"
                executeJavaScript(
                    """
                    document.documentElement.classList.remove('dark', 'light');
                    document.documentElement.classList.add('$themeClass');
                    window.dispatchEvent(new CustomEvent('spek:themeChange', { detail: { theme: '$themeClass' } }));
                    """.trimIndent(),
                )
            },
        )
    }

    override fun dispose() {
        // Both the browser and the message bus connection are registered against this, so Disposer releases them.
    }
}
