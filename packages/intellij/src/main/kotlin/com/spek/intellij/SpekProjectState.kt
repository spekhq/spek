package com.spek.intellij

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project

@Service(Service.Level.PROJECT)
class SpekProjectState {
    var hasOpenSpec: Boolean = false

    companion object {
        fun getInstance(project: Project): SpekProjectState {
            return project.getService(SpekProjectState::class.java)
        }
    }
}
