package com.spek.intellij

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.spek.intellij.core.OpenSpecScanner

class SpekStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        val basePath = project.basePath ?: return
        val hasOpenSpec = OpenSpecScanner.hasOpenSpec(basePath)
        SpekProjectState.getInstance(project).hasOpenSpec = hasOpenSpec
    }
}
