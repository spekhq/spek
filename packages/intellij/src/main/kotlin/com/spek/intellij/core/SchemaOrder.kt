package com.spek.intellij.core

import com.intellij.openapi.application.ApplicationManager
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/** schema 中單一 artifact 的權威參照（由 openspec CLI 提供） */
data class SchemaArtifactRef(
    val id: String,
    val outputPath: String,
)

/**
 * 提供某個 change 的權威 artifact 順序。回 null 代表無法取得（CLI 不存在、archived change、
 * 或任何錯誤），此時 schemaOrder 為 null。對齊 @spek/core 的 SchemaOrderProvider。
 */
fun interface SchemaOrderProvider {
    fun order(repoRoot: String, slug: String): List<SchemaArtifactRef>?
}

object SchemaOrder {
    private val json = Json { ignoreUnknownKeys = true }

    // 內建 server 的 handler 由 Netty 多執行緒進入 → 用 ConcurrentHashMap 避免 HashMap 併發改寫
    // 造成結構性損壞 / ConcurrentModificationException。值以非空的 CacheEntry 包裝：CHM 不允許
    // null value，而 CLI 不可用時的結果本身是 null，故不可直接存 null——包一層即可安全快取「已算過、
    // 無順序」。get→測 TTL→spawn→put 之間的競態是良性的（重複做一次等冪工作、後寫覆蓋、值相同）。
    private data class CacheEntry(val at: Long, val value: List<SchemaArtifactRef>?)
    private const val CACHE_TTL_MS = 30_000L
    // size cap（對齊 TS 版）：SchemaOrder 為整個 IDE 生命週期的 application 級 singleton，跨所有專案
    // 視窗共用，比 TS 的 dev-server 行程更長壽，更需要上限。CHM 無插入序，故非嚴格 FIFO——僅在超限時
    // 移除任一既有條目以「有界化」成長（嚴格 FIFO 需 synchronized LinkedHashMap，對 best-effort 快取不值得）。
    private const val CACHE_MAX = 256
    private val cache = ConcurrentHashMap<String, CacheEntry>()

    /**
     * 由 `openspec status --change <slug> --json` 輸出萃取權威順序：
     * actionContext.planningArtifacts 提供順序，artifactPaths[id].outputPath 提供產出路徑。
     * 純函式，方便單元測試；解析不出任何 artifact 時回 null。
     */
    fun parseOrderFromStatus(jsonText: String): List<SchemaArtifactRef>? {
        return try {
            val root = json.parseToJsonElement(jsonText).jsonObject
            val order = root["actionContext"]?.jsonObject?.get("planningArtifacts")?.jsonArray ?: return null
            val paths = root["artifactPaths"]?.jsonObject ?: return null
            val refs = mutableListOf<SchemaArtifactRef>()
            // 逐一以安全轉型跳過壞元素（非字串 id、outputPath 非物件/非字串），與 TS 版一致：
            // 單一壞元素只被略過而非讓整份解析回 null（`?.` / `as?` 不 throw，故不觸發外層 catch）
            for (el in order) {
                val id = (el as? JsonPrimitive)?.takeIf { it.isString }?.content ?: continue
                val outputPath = (paths[id] as? JsonObject)?.get("outputPath")
                    ?.let { it as? JsonPrimitive }?.takeIf { it.isString }?.content ?: continue
                refs.add(SchemaArtifactRef(id, outputPath))
            }
            if (refs.isNotEmpty()) refs else null
        } catch (_: Exception) {
            null
        }
    }

    /** 將 openspec artifact 的 outputPath 對應到已知 artifact id；對不到回 null（glob 僅支援 specs tree） */
    private fun idForOutputPath(outputPath: String, knownIds: Set<String>): String? {
        val g = outputPath.trim()
        if (g.contains("*")) {
            if (Regex("""(^|/)specs(/|$)""").containsMatchIn(g) && knownIds.contains("specs")) return "specs"
            return null
        }
        val base = g.split(Regex("""[\\/]""")).last()
        val stem = base.replace(Regex("""\.md$""", RegexOption.IGNORE_CASE), "")
        if (knownIds.contains(stem)) return stem
        if (Regex("""^spec\.md$""", RegexOption.IGNORE_CASE).matches(base) &&
            Regex("specs", RegexOption.IGNORE_CASE).containsMatchIn(g) && knownIds.contains("specs")
        ) return "specs"
        return null
    }

    /**
     * 由 refs（schema 權威順序）與已探索的 artifact id 集合，產生排序後的 artifact-id 清單。
     * 每個 ref 依 outputPath 對應到一個已知 id、去重；對不到略過。refs 為 null 或無有效對應時回 null。
     */
    fun resolveSchemaOrder(refs: List<SchemaArtifactRef>?, knownIds: List<String>): List<String>? {
        if (refs == null) return null
        val known = knownIds.toSet()
        val ordered = mutableListOf<String>()
        val used = HashSet<String>()
        for (ref in refs) {
            val id = idForOutputPath(ref.outputPath, known)
            if (id != null && !used.contains(id)) {
                ordered.add(id)
                used.add(id)
            }
        }
        return if (ordered.isNotEmpty()) ordered else null
    }

    /**
     * 預設 SchemaOrderProvider：呼叫 openspec CLI 取得權威順序。
     * openspec 未安裝 / 非 0 結束 / archived change / 解析失敗時一律回 null。
     */
    val cli = SchemaOrderProvider { repoRoot, slug ->
        val cacheKey = "$repoRoot::$slug"
        // TTL ≥ CLI timeout：TTL 內的 hit 必已完成計算（CLI 至多 10s），復用安全、不重複 spawn。
        // 過期後（openspec 之後才安裝、artifact 順序改變）自動重查，避免 null / 舊順序被永久快取。
        cache[cacheKey]?.let {
            if (System.currentTimeMillis() - it.at <= CACHE_TTL_MS) return@SchemaOrderProvider it.value
            cache.remove(cacheKey)
        }

        var result: List<SchemaArtifactRef>? = null
        // slug 來自資料夾名稱。Windows 上以 ProcessBuilder 啟動 openspec.cmd 時，argv 會再經
        // cmd.exe 解析（BatBadBut / CVE-2024-27980），ProcessBuilder 不會像 Node 的 cross-spawn
        // 那樣自動轉義 —— 故此處必須以白名單限定安全字元擋掉 argument injection。此為安全邊界，
        // 勿為「對齊 TS 版」而刪除：TS 改用 cross-spawn 已由結構排除注入，兩邊刻意不同。
        if (Regex("""^[\w.-]+$""").matches(slug)) {
            try {
                val bin = if (System.getProperty("os.name").orEmpty().lowercase().contains("win"))
                    "openspec.cmd" else "openspec"
                // 防呆點：(1) stderr 導向 DISCARD（不併入 stdout，故 JSON 不被診斷訊息污染，也沒有
                // 未被抽乾的 stderr pipe 會塞爆而卡死子行程）；(2) 於 IDE 的 pooled thread 抽乾 stdout，
                // 子行程不會因 stdout pipe 滿而阻塞；用 executeOnPooledThread 而非 commonPool——後者
                // parallelism = cores-1，阻塞式 read 會佔住 worker，低核機併發時 reader task 可能排不上
                // 而讓 get 誤逾時、把健康 CLI 的結果誤存成 null；IDE pooled pool 為 cached 型、適合阻塞 IO。
                // (3) waitFor 有硬性 timeout，逾時 destroyForcibly 收掉子行程 → stdout 關閉 → read 得 EOF
                // 而返回（Future.cancel 無法中斷執行中的 read，真正解除阻塞的是 destroyForcibly）。
                // (4) 以 future.get 取回輸出（提供 happens-before，避免跨執行緒讀取的資料競態）。
                val proc = ProcessBuilder(bin, "status", "--change", slug, "--json")
                    .directory(File(repoRoot))
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start()
                val reader = ApplicationManager.getApplication().executeOnPooledThread(
                    Callable { proc.inputStream.bufferedReader().use { it.readText() } },
                )
                val finished = proc.waitFor(10, TimeUnit.SECONDS)
                if (!finished) {
                    proc.destroyForcibly()
                    reader.cancel(true)
                } else if (proc.exitValue() == 0) {
                    result = parseOrderFromStatus(reader.get(2, TimeUnit.SECONDS))
                }
            } catch (_: Exception) {
                result = null
            }
        }

        if (cache.size >= CACHE_MAX) cache.keys.firstOrNull()?.let { cache.remove(it) }
        cache[cacheKey] = CacheEntry(System.currentTimeMillis(), result)
        result
    }

    fun clearCache() = cache.clear()
}
