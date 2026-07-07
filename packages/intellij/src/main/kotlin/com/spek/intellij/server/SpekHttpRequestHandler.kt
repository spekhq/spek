package com.spek.intellij.server

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.spek.intellij.core.*
import io.netty.buffer.Unpooled
import io.netty.channel.ChannelHandlerContext
import io.netty.handler.codec.http.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.ide.HttpRequestHandler
import java.nio.charset.StandardCharsets

class SpekHttpRequestHandler : HttpRequestHandler() {
    private val log = Logger.getInstance(SpekHttpRequestHandler::class.java)
    private val json = Json { encodeDefaults = true }

    companion object {
        private const val API_PREFIX = "/api/spek/"
        private const val WEBVIEW_PREFIX = "/spek/webview/"
    }

    override fun isSupported(request: FullHttpRequest): Boolean {
        val uri = request.uri().substringBefore("?")
        return uri.startsWith(API_PREFIX) || uri.startsWith(WEBVIEW_PREFIX)
    }

    override fun process(
        urlDecoder: QueryStringDecoder,
        request: FullHttpRequest,
        context: ChannelHandlerContext,
    ): Boolean {
        val path = urlDecoder.path()

        // 靜態資源
        if (path.startsWith(WEBVIEW_PREFIX)) {
            return serveStaticResource(path, context)
        }

        // API 路由
        if (!path.startsWith(API_PREFIX)) return false

        val apiPath = path.removePrefix(API_PREFIX).trimEnd('/')
        val params = urlDecoder.parameters()
        val projectPath = params["projectPath"]?.firstOrNull()

        if (projectPath.isNullOrBlank() && apiPath.startsWith("openspec/")) {
            return sendError(context, HttpResponseStatus.BAD_REQUEST, "Missing projectPath parameter")
        }

        // 把 API 路由（含檔案掃描與 openspec CLI 子行程）移出內建 server 的 Netty 執行緒——該執行緒
        // 池為整個 IDE 內建 server 共用，若在此同步等待 CLI（至多 10s）會拖累其他平台功能。改丟到
        // pooled thread 處理；Netty 的 writeAndFlush 可安全跨執行緒呼叫，故 handler 立即回 true。
        ApplicationManager.getApplication().executeOnPooledThread {
            dispatchApiRequest(apiPath, projectPath, params, path, context)
        }
        return true
    }

    // 於 pooled thread 執行實際路由並寫回回應；回傳 Unit，寫入前檢查 channel 是否仍連線。
    private fun dispatchApiRequest(
        apiPath: String,
        projectPath: String?,
        params: Map<String, List<String>>,
        path: String,
        context: ChannelHandlerContext,
    ) {
        try {
            val result = routeRequest(apiPath, projectPath ?: "", params)
            if (!context.channel().isActive) return // client 已斷線
            if (result != null) {
                sendJson(context, result)
            } else {
                sendError(context, HttpResponseStatus.NOT_FOUND, "Endpoint not found: $apiPath")
            }
        } catch (e: Exception) {
            log.error("Error handling request: $path", e)
            if (context.channel().isActive) {
                sendError(context, HttpResponseStatus.INTERNAL_SERVER_ERROR, e.message ?: "Internal error")
            }
        }
    }

    private fun routeRequest(
        apiPath: String,
        projectPath: String,
        params: Map<String, List<String>>,
    ): String? {
        // openspec/overview
        if (apiPath == "openspec/overview") {
            return handleOverview(projectPath)
        }

        // openspec/specs/:topic/at/:slug
        val specAtChangeMatch = Regex("""^openspec/specs/([^/]+)/at/([^/]+)$""").find(apiPath)
        if (specAtChangeMatch != null) {
            val topic = specAtChangeMatch.groupValues[1]
            val slug = specAtChangeMatch.groupValues[2]
            return handleSpecAtChange(projectPath, topic, slug)
        }

        // openspec/specs/:topic
        val specDetailMatch = Regex("""^openspec/specs/([^/]+)$""").find(apiPath)
        if (specDetailMatch != null) {
            val topic = specDetailMatch.groupValues[1]
            return handleSpecDetail(projectPath, topic)
        }

        // openspec/specs
        if (apiPath == "openspec/specs") {
            return handleSpecs(projectPath)
        }

        // openspec/changes/:slug
        val changeDetailMatch = Regex("""^openspec/changes/([^/]+)$""").find(apiPath)
        if (changeDetailMatch != null) {
            val slug = changeDetailMatch.groupValues[1]
            return handleChangeDetail(projectPath, slug)
        }

        // openspec/changes
        if (apiPath == "openspec/changes") {
            return handleChanges(projectPath)
        }

        // openspec/graph
        if (apiPath == "openspec/graph") {
            return handleGraph(projectPath)
        }

        // openspec/search
        if (apiPath == "openspec/search") {
            val query = params["q"]?.firstOrNull() ?: ""
            return handleSearch(projectPath, query)
        }

        // fs/detect
        if (apiPath == "fs/detect") {
            val path = params["path"]?.firstOrNull() ?: projectPath
            return handleDetect(path)
        }

        return null
    }

    private fun handleOverview(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        var totalTasks = 0
        var completedTasks = 0
        for (change in scan.activeChanges + scan.archivedChanges) {
            change.taskStats?.let {
                totalTasks += it.total
                completedTasks += it.completed
            }
        }
        val overview = OverviewData(
            specsCount = scan.specs.size,
            changesCount = ChangesCount(scan.activeChanges.size, scan.archivedChanges.size),
            taskStats = TaskStats(totalTasks, completedTasks),
        )
        return json.encodeToString(overview)
    }

    private fun handleSpecs(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        return json.encodeToString(scan.specs)
    }

    private fun handleSpecDetail(projectPath: String, topic: String): String? {
        val spec = SpecReader.read(projectPath, topic) ?: return null
        return json.encodeToString(spec)
    }

    private fun handleSpecAtChange(projectPath: String, topic: String, slug: String): String? {
        val result = SpecReader.readAtChange(projectPath, topic, slug) ?: return null
        return json.encodeToString(result)
    }

    private fun handleChanges(projectPath: String): String {
        val scan = OpenSpecScanner.scan(projectPath)
        val data = ChangesData(scan.activeChanges, scan.archivedChanges)
        return json.encodeToString(data)
    }

    private fun handleChangeDetail(projectPath: String, slug: String): String? {
        val change = ChangeReader.read(projectPath, slug) ?: return null
        return json.encodeToString(change)
    }

    private fun handleGraph(projectPath: String): String {
        val data = GraphBuilder.build(projectPath)
        return json.encodeToString(data)
    }

    private fun handleSearch(projectPath: String, query: String): String {
        val results = SearchService.search(projectPath, query)
        return json.encodeToString(results)
    }

    private fun handleDetect(path: String): String {
        val data = DetectData(hasOpenSpec = OpenSpecScanner.hasOpenSpec(path))
        return json.encodeToString(data)
    }

    private fun serveStaticResource(path: String, context: ChannelHandlerContext): Boolean {
        val resourcePath = "webview/" + path.removePrefix(WEBVIEW_PREFIX)
        val resource = javaClass.classLoader.getResource(resourcePath) ?: return false

        val bytes = resource.readBytes()
        val contentType = when {
            resourcePath.endsWith(".html") -> "text/html; charset=utf-8"
            resourcePath.endsWith(".js") -> "application/javascript; charset=utf-8"
            resourcePath.endsWith(".css") -> "text/css; charset=utf-8"
            resourcePath.endsWith(".svg") -> "image/svg+xml"
            resourcePath.endsWith(".png") -> "image/png"
            else -> "application/octet-stream"
        }

        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            HttpResponseStatus.OK,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, contentType)
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            set(HttpHeaderNames.CACHE_CONTROL, "no-cache")
        }
        context.channel().writeAndFlush(response)
        return true
    }

    private fun sendJson(context: ChannelHandlerContext, jsonStr: String): Boolean {
        val bytes = jsonStr.toByteArray(StandardCharsets.UTF_8)
        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            HttpResponseStatus.OK,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=utf-8")
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_METHODS, "GET, POST, OPTIONS")
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        }
        context.channel().writeAndFlush(response)
        return true
    }

    private fun sendError(
        context: ChannelHandlerContext,
        status: HttpResponseStatus,
        message: String,
    ): Boolean {
        val errorJson = """{"error":"$message"}"""
        val bytes = errorJson.toByteArray(StandardCharsets.UTF_8)
        val response = DefaultFullHttpResponse(
            HttpVersion.HTTP_1_1,
            status,
            Unpooled.wrappedBuffer(bytes),
        )
        response.headers().apply {
            set(HttpHeaderNames.CONTENT_TYPE, "application/json; charset=utf-8")
            set(HttpHeaderNames.CONTENT_LENGTH, bytes.size)
            set(HttpHeaderNames.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        }
        context.channel().writeAndFlush(response)
        return true
    }
}
