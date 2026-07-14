package com.spek.intellij.server

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SpekHttpRequestHandlerTest {

    /**
     * 迴歸測試：這條路由曾經根本不存在，導致三個宿主共用的前端每按一次 Refresh，
     * IntelliJ 就回一個 404 —— 前端沒有 catch，於是整顆按鈕靜默失效（issue #18）。
     */
    @Test
    fun resyncRouteExistsAndReportsOk() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/tmp/does-not-matter", emptyMap())

        assertEquals("""{"ok":true}""", result, "resync 必須被路由到，且回報成功")
    }

    /** 未知路徑仍須回 null（由呼叫端轉成 404），確認上面那條不是靠萬用比對矇到的。 */
    @Test
    fun unknownRouteReturnsNull() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/no-such-endpoint", "/tmp/does-not-matter", emptyMap())

        assertNull(result)
    }

    /** resync 不讀專案內容，故不得因為 projectPath 不存在而丟例外。 */
    @Test
    fun resyncDoesNotTouchTheProjectDirectory() {
        val handler = SpekHttpRequestHandler()

        val result = handler.routeRequest("openspec/resync", "/nonexistent/project/path", emptyMap())

        assertEquals("""{"ok":true}""", result)
    }
}
