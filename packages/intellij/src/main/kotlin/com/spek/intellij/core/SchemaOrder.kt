package com.spek.intellij.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
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
    private val cache = HashMap<String, List<SchemaArtifactRef>?>()

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
            for (el in order) {
                val id = el.jsonPrimitive.takeIf { it.isString }?.content ?: continue
                val outputPath = paths[id]?.jsonObject?.get("outputPath")?.jsonPrimitive
                    ?.takeIf { it.isString }?.content ?: continue
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
        if (cache.containsKey(cacheKey)) return@SchemaOrderProvider cache[cacheKey]

        var result: List<SchemaArtifactRef>? = null
        // slug 來自資料夾名稱。Windows 上以 ProcessBuilder 啟動 openspec.cmd 時，argv 會再經
        // cmd.exe 解析（BatBadBut / CVE-2024-27980），ProcessBuilder 不會像 Node 的 cross-spawn
        // 那樣自動轉義 —— 故此處必須以白名單限定安全字元擋掉 argument injection。此為安全邊界，
        // 勿為「對齊 TS 版」而刪除：TS 改用 cross-spawn 已由結構排除注入，兩邊刻意不同。
        if (Regex("""^[\w.-]+$""").matches(slug)) {
            try {
                val bin = if (System.getProperty("os.name").orEmpty().lowercase().contains("win"))
                    "openspec.cmd" else "openspec"
                val proc = ProcessBuilder(bin, "status", "--change", slug, "--json")
                    .directory(File(repoRoot))
                    .redirectErrorStream(false)
                    .start()
                val out = proc.inputStream.bufferedReader().readText()
                val finished = proc.waitFor(10, TimeUnit.SECONDS)
                if (finished && proc.exitValue() == 0) {
                    result = parseOrderFromStatus(out)
                } else if (!finished) {
                    proc.destroyForcibly()
                }
            } catch (_: Exception) {
                result = null
            }
        }

        cache[cacheKey] = result
        result
    }

    fun clearCache() = cache.clear()
}
