package com.spek.intellij

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.*
import java.util.Timer
import java.util.TimerTask
import javax.swing.JComponent
import javax.swing.JLabel
import javax.swing.SwingConstants
import kotlin.concurrent.thread

class SpekBrowserPanel(private val project: Project) : Disposable {
    private val log = Logger.getInstance(SpekBrowserPanel::class.java)
    private var browser: JBCefBrowser? = null
    private var debounceTimer: Timer? = null
    private var watchThread: Thread? = null
    private var watchService: WatchService? = null
    @Volatile private var disposed = false

    val component: JComponent

    init {
        component = if (JBCefApp.isSupported()) {
            createBrowserComponent()
        } else {
            createFallbackComponent()
        }

        setupNativeFileWatcher()
    }

    private fun createBrowserComponent(): JComponent {
        // 先建立空白 browser，等 Built-in Server 就緒後再載入 URL
        val jcefBrowser = JBCefBrowser()
        browser = jcefBrowser
        Disposer.register(this, jcefBrowser)

        setupThemeListener(jcefBrowser)

        // 在背景等待 server 啟動並確認 API handler 就緒，再於 EDT 載入 URL
        ApplicationManager.getApplication().executeOnPooledThread {
            org.jetbrains.ide.BuiltInServerManager.getInstance().waitForStart()
            if (disposed) return@executeOnPooledThread

            val port = org.jetbrains.ide.BuiltInServerManager.getInstance().port
            val projectPath = project.basePath ?: ""
            val encodedPath = java.net.URLEncoder.encode(projectPath, "UTF-8")

            // 輪詢確認 API handler 已註冊並可回應，避免啟動時 404
            waitForApiReady(port, encodedPath)
            if (disposed) return@executeOnPooledThread

            ApplicationManager.getApplication().invokeLater {
                if (disposed) return@invokeLater
                val isDark = isIdeInDarkMode()
                val theme = if (isDark) "dark" else "light"
                val url = "http://localhost:$port/spek/webview/index.intellij.html" +
                    "?projectPath=$encodedPath&apiBase=http://localhost:$port/api/spek&theme=$theme"
                jcefBrowser.loadURL(url)
            }
        }

        return jcefBrowser.component
    }

    private fun createFallbackComponent(): JComponent {
        return JLabel(
            "<html><center>JCEF is not available.<br>Please use a JetBrains IDE version that supports JCEF.</center></html>",
            SwingConstants.CENTER,
        )
    }

    private fun isIdeInDarkMode(): Boolean {
        return !com.intellij.ui.JBColor.isBright()
    }

    private fun setupThemeListener(jcefBrowser: JBCefBrowser) {
        val connection = ApplicationManager.getApplication().messageBus.connect(this)
        connection.subscribe(
            com.intellij.ide.ui.LafManagerListener.TOPIC,
            com.intellij.ide.ui.LafManagerListener {
                val isDark = isIdeInDarkMode()
                val themeClass = if (isDark) "dark" else "light"
                jcefBrowser.cefBrowser.executeJavaScript(
                    """
                    document.documentElement.classList.remove('dark', 'light');
                    document.documentElement.classList.add('$themeClass');
                    window.dispatchEvent(new CustomEvent('spek:themeChange', { detail: { theme: '$themeClass' } }));
                    """.trimIndent(),
                    "",
                    0,
                )
            },
        )
    }

    private fun setupNativeFileWatcher() {
        val basePath = project.basePath ?: return
        val openspecDir = File(basePath, "openspec")
        if (!openspecDir.isDirectory) return

        val ws = FileSystems.getDefault().newWatchService()
        watchService = ws

        // 遞迴註冊 openspec/ 下所有子目錄
        registerDirRecursively(openspecDir.toPath(), ws)

        watchThread = thread(isDaemon = true, name = "spek-file-watcher") {
            try {
                while (!disposed) {
                    val key = ws.poll(1, java.util.concurrent.TimeUnit.SECONDS) ?: continue
                    var hasRelevantChange = false

                    for (event in key.pollEvents()) {
                        if (event.kind() == StandardWatchEventKinds.OVERFLOW) continue
                        hasRelevantChange = true

                        // 新建的目錄也需要註冊
                        if (event.kind() == StandardWatchEventKinds.ENTRY_CREATE) {
                            val context = event.context() as? Path ?: continue
                            val dir = (key.watchable() as Path).resolve(context)
                            if (dir.toFile().isDirectory) {
                                registerDirRecursively(dir, ws)
                            }
                        }
                    }

                    key.reset()

                    if (hasRelevantChange) {
                        scheduleRefresh()
                    }
                }
            } catch (_: ClosedWatchServiceException) {
                // 正常關閉
            } catch (e: Exception) {
                if (!disposed) {
                    log.warn("File watcher error", e)
                }
            }
        }
    }

    private fun registerDirRecursively(dir: Path, ws: WatchService) {
        try {
            dir.register(
                ws,
                StandardWatchEventKinds.ENTRY_CREATE,
                StandardWatchEventKinds.ENTRY_MODIFY,
                StandardWatchEventKinds.ENTRY_DELETE,
            )
            // 註冊子目錄
            dir.toFile().listFiles()
                ?.filter { it.isDirectory && !it.name.startsWith(".") }
                ?.forEach { registerDirRecursively(it.toPath(), ws) }
        } catch (e: Exception) {
            log.debug("Cannot watch directory: $dir", e)
        }
    }

    private fun scheduleRefresh() {
        synchronized(this) {
            debounceTimer?.cancel()
            debounceTimer = Timer().apply {
                schedule(object : TimerTask() {
                    override fun run() {
                        notifyWebviewFileChanged()
                    }
                }, 500)
            }
        }
    }

    private fun notifyWebviewFileChanged() {
        browser?.cefBrowser?.executeJavaScript(
            "window.dispatchEvent(new CustomEvent('spek:fileChanged'));",
            "",
            0,
        )
    }

    private fun waitForApiReady(port: Int, encodedProjectPath: String) {
        val maxRetries = 50
        val retryIntervalMs = 200L
        val checkUrl = "http://localhost:$port/api/spek/fs/detect?path=$encodedProjectPath"

        for (i in 1..maxRetries) {
            if (disposed) return
            try {
                val conn = URL(checkUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 500
                conn.readTimeout = 500
                conn.requestMethod = "GET"
                val code = conn.responseCode
                conn.disconnect()
                if (code == 200) {
                    log.info("API handler ready after $i attempt(s)")
                    return
                }
            } catch (_: Exception) {
                // 連線失敗，handler 尚未就緒
            }
            Thread.sleep(retryIntervalMs)
        }
        log.warn("API handler not ready after ${maxRetries * retryIntervalMs}ms, loading webview anyway")
    }

    fun navigateTo(path: String) {
        val escapedPath = path.replace("'", "\\'")
        browser?.cefBrowser?.executeJavaScript(
            "window.dispatchEvent(new CustomEvent('spek:navigate', { detail: { path: '$escapedPath' } }));",
            "",
            0,
        )
    }

    override fun dispose() {
        disposed = true
        debounceTimer?.cancel()
        debounceTimer = null
        watchService?.close()
        watchThread?.interrupt()
    }
}
