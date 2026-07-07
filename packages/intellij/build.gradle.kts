plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.25"
    id("org.jetbrains.intellij.platform") version "2.2.1"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity(providers.gradleProperty("platformVersion").get())
        pluginVerifier()
    }
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // 純邏輯單元測試（OpenSpecScanner / ChangeReader / WatchPolling 只吃路徑與本機檔案，不依賴 IntelliJ platform）
    // kotlin("test")：WatchPollingTest 用 kotlin.test.* 斷言；junit-jupiter：以 JUnit5 平台執行
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    pluginConfiguration {
        id = "tw.kewang.spek"
        name = "spek - OpenSpec Viewer"
        version = providers.gradleProperty("pluginVersion").get()
        description = "OpenSpec content viewer for IntelliJ-based IDEs"
        vendor {
            name = "spek"
            url = "https://github.com/kewang/spek"
        }
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild").get()
            untilBuild = provider { null }
        }
    }
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

tasks {
    wrapper {
        gradleVersion = "8.11.1"
    }
    test {
        useJUnitPlatform()
    }
}
