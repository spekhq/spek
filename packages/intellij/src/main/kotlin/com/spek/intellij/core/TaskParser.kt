package com.spek.intellij.core

object TaskParser {
    private val CHECKBOX_RE = Regex("""^- \[([ xX])] (.+)$""")
    private val SECTION_RE = Regex("""^## (.+)$""")

    fun parse(content: String): ParsedTasks {
        val lines = content.replace("\r\n", "\n").split("\n")
        val sections = mutableListOf<TaskSection>()
        var currentTitle = ""
        var currentTasks = mutableListOf<TaskItem>()
        var total = 0
        var completed = 0

        for (line in lines) {
            val sectionMatch = SECTION_RE.find(line)
            if (sectionMatch != null) {
                if (currentTasks.isNotEmpty()) {
                    sections.add(TaskSection(currentTitle, currentTasks.toList()))
                }
                currentTitle = sectionMatch.groupValues[1].trim()
                currentTasks = mutableListOf()
                continue
            }

            val taskMatch = CHECKBOX_RE.find(line)
            if (taskMatch != null) {
                val done = taskMatch.groupValues[1].lowercase() == "x"
                currentTasks.add(TaskItem(taskMatch.groupValues[2].trim(), done))
                total++
                if (done) completed++
            }
        }

        if (currentTasks.isNotEmpty()) {
            sections.add(TaskSection(currentTitle, currentTasks.toList()))
        }

        return ParsedTasks(total, completed, sections)
    }
}
