package com.spek.intellij.core

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Mirror of @spekjs/core's spec-topic.ts: which strings are spec topics and how a topic
 * becomes an app route. A topic is the slash-separated directory path of a `spec.md` relative to its
 * `specs/` root. The patterns anchor with `\A`/`\z`: Java's `$` also matches before a trailing newline,
 * so `^…$` would accept `"auth\n"` on this side only.
 */
object SpecTopic {
    // A segment never begins with `.` (which also rules out `.` and `..`), and holds no separator of either
    // kind, no NUL and no control character.
    private const val SEGMENT = """[^./\\\x00-\x1F\x7F][^/\\\x00-\x1F\x7F]*"""
    private val TOPIC = Regex("""\A$SEGMENT(?:/$SEGMENT)*\z""")
    private val SLUG = Regex("""\A$SEGMENT\z""")

    fun isSafeTopic(topic: String): Boolean = TOPIC.containsMatchIn(topic)

    /** One change-directory name. `archive` is the archived changes' parent, not a change. */
    fun isSafeChangeSlug(slug: String): Boolean = slug != "archive" && SLUG.containsMatchIn(slug)

    /** The app route of a spec, each segment encoded as `encodeURIComponent` would. */
    fun route(topic: String): String = "/specs/" + topic.split('/').joinToString("/") { encodeSegment(it) }

    private fun encodeSegment(segment: String): String =
        URLEncoder.encode(segment, StandardCharsets.UTF_8)
            .replace("+", "%20")
            .replace("%21", "!")
            .replace("%27", "'")
            .replace("%28", "(")
            .replace("%29", ")")
            .replace("%7E", "~")
}
