import groovy.json.JsonSlurper
import java.time.Instant
import java.security.MessageDigest
import java.util.zip.ZipFile
import org.gradle.api.artifacts.component.ModuleComponentIdentifier
import org.gradle.api.artifacts.result.ResolvedArtifactResult
import org.gradle.maven.MavenModule
import org.gradle.maven.MavenPomArtifact

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "dev.bota.examples.recordings"
    compileSdk = 36
    defaultConfig {
        applicationId = "dev.bota.examples.recordings.kotlin"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "dev.bota.examples.recordings.TransportInstrumentation"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
    sourceSets {
        getByName("test") { java.srcDir("src/sharedTest/java"); resources.srcDir("src/sharedTest/resources") }
        getByName("androidTest") { java.srcDir("src/sharedTest/java"); resources.srcDir("src/sharedTest/resources") }
    }
    lint { abortOnError = true } // Retained-version/target advisories remain visible; lint errors still fail.
}
dependencyLocking { lockAllConfigurations(); lockMode.set(LockMode.STRICT) }
dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    implementation("org.apache.httpcomponents.core5:httpcore5:5.4.4")
    testImplementation("org.testng:testng:7.10.2")
}
tasks.withType<Test>().configureEach { useTestNG() }

// Resolve the complete debug/release application and JVM-test graphs. Android's
// internal/self-project artifact configurations cannot be resolved generically.
tasks.register("resolveDependencies") {
    doLast {
        val names = listOf("debugCompileClasspath", "debugRuntimeClasspath", "releaseCompileClasspath", "releaseRuntimeClasspath", "debugAndroidTestCompileClasspath", "debugAndroidTestRuntimeClasspath",
            "debugUnitTestCompileClasspath", "debugUnitTestRuntimeClasspath", "releaseUnitTestCompileClasspath", "releaseUnitTestRuntimeClasspath")
        val output = layout.buildDirectory.file("dependency-artifacts.tsv").get().asFile
        output.parentFile.mkdirs()
        val binaries = names.flatMap { configurations.getByName(it).incoming.artifactView {
            componentFilter { it is org.gradle.api.artifacts.component.ModuleComponentIdentifier }
        }.artifacts.artifacts }.associate {
            val id = it.id.componentIdentifier as org.gradle.api.artifacts.component.ModuleComponentIdentifier
            "${id.group}:${id.module}:${id.version}" to it.file.absolutePath
        }
        output.writeText(names.flatMap { configurations.getByName(it).incoming.resolutionResult.allComponents }
            .mapNotNull { it.id as? org.gradle.api.artifacts.component.ModuleComponentIdentifier }
            .map { "${it.group}:${it.module}:${it.version}" }.distinct().sorted()
            .joinToString("\n") { "$it\t${binaries[it].orEmpty()}" } + "\n")
    }
}
// The reviewed POM/hash/age inventory is checked against the entire resolved app/test graph.
// Build plugins, Android SDK tools and the JDK are separately pinned toolchain inputs.
tasks.register("checkDependencyLicenses") {
    doLast {
        val inventory = JsonSlurper().parse(rootProject.file("dependency-provenance.json")) as Map<*, *>
        val records = (inventory["artifacts"] as List<*>).map { it as Map<*, *> }.associateBy { it["coordinate"] as String }
        val modules = listOf("debugRuntimeClasspath", "releaseRuntimeClasspath", "debugUnitTestRuntimeClasspath", "releaseUnitTestRuntimeClasspath", "debugAndroidTestRuntimeClasspath")
            .flatMap { configurations.getByName(it).incoming.resolutionResult.allComponents }
            .mapNotNull { it.id as? ModuleComponentIdentifier }.toSet()
        val resolved = modules.map { "${it.group}:${it.module}:${it.version}" }.toSet()
        check(resolved == records.keys) { "Resolved app/test dependency inventory changed. Review exact public POMs, age, licenses and hashes before refreshing it." }
        val allowed = setOf("Apache-2.0", "MIT", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0")
        records.forEach { (coordinate, record) ->
            check(record["license"] in allowed) { "Unknown or forbidden license for $coordinate" }
            check((record["pomSha256"] as? String)?.matches(Regex("[a-f0-9]{64}")) == true) { "Missing reviewed POM identity for $coordinate" }
            check((record["publishedAt"] as? String)?.let { Instant.parse(it).isBefore(Instant.now().minusSeconds(7 * 86400)) } == true) { "Dependency is younger than seven days: $coordinate" }
        }
        fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        val poms = dependencies.createArtifactResolutionQuery().forComponents(modules)
            .withArtifacts(MavenModule::class.java, MavenPomArtifact::class.java).execute().resolvedComponents
        check(poms.size == records.size) { "Missing resolved public POM metadata" }
        poms.forEach { component ->
            val id = component.id as ModuleComponentIdentifier
            val coordinate = "${id.group}:${id.module}:${id.version}"
            val pom = component.getArtifacts(MavenPomArtifact::class.java).single() as? ResolvedArtifactResult
                ?: error("Unresolved POM for $coordinate")
            check(digest(pom.file.readBytes()) == records.getValue(coordinate)["pomSha256"]) { "Reviewed POM/license metadata changed for $coordinate" }
        }
        // Verify the actual resolved files, not only metadata labels in the checked inventory.
        val checked = mutableSetOf<String>()
        listOf("debugRuntimeClasspath", "releaseRuntimeClasspath", "debugUnitTestRuntimeClasspath", "releaseUnitTestRuntimeClasspath", "debugAndroidTestRuntimeClasspath").forEach { name ->
            configurations.getByName(name).incoming.artifactView {
                componentFilter { it is ModuleComponentIdentifier }
            }.artifacts.artifacts.forEach { artifact ->
                val id = artifact.id.componentIdentifier as ModuleComponentIdentifier
                val coordinate = "${id.group}:${id.module}:${id.version}"
                val record = records.getValue(coordinate)
                val expected = record["sha256"] as? String ?: error("Missing artifact hash for $coordinate")
                val actual = digest(artifact.file.readBytes())
                check(actual == expected) { "Resolved artifact identity changed for $coordinate" }
                // POM labels alone miss differently licensed bundled data. Review
                // all notice identities and refuse nested/data payloads explicitly.
                val reviewed = (record["bundledNotices"] as? List<*>)?.map { it as Map<*, *> }
                    ?.associate { it["path"] as String to it["sha256"] as String }
                    ?: error("Missing bundled-notice review for $coordinate")
                val notices = mutableMapOf<String, String>()
                ZipFile(artifact.file).use { archive ->
                    archive.entries().asSequence().forEach { entry ->
                        val path = entry.name
                        check(!Regex("(?i)public.?suffix|(?:^|/)psl(?:[./]|$)|\\.(?:gz|jar|zip|aar)$").containsMatchIn(path)) {
                            "Bundled data/archive requires separate license review: $coordinate $path"
                        }
                        if (Regex("(?i)(?:^|/)(?:license|notice|copying|copyright)(?:[./_-]|$)").containsMatchIn(path)) {
                            check(entry.size in 0..(2L * 1024 * 1024)) { "Unbounded bundled notice: $coordinate $path" }
                            val data = archive.getInputStream(entry).use { it.readBytes() }
                            val text = data.toString(Charsets.UTF_8)
                            check(!Regex("(?i)Mozilla Public License|GNU (?:Affero |Lesser |Library )?General Public License|Eclipse Public License|Creative Commons Attribution-NonCommercial|SPDX-License-Identifier:\\s*(?:MPL|GPL|LGPL|AGPL|EPL)").containsMatchIn(text)) {
                                "Forbidden bundled license: $coordinate $path"
                            }
                            notices[path] = digest(data)
                        }
                    }
                }
                check(notices == reviewed) { "Bundled license/notice inventory changed for $coordinate" }
                checked.add(coordinate)
            }
        }
        println("No forbidden licenses: ${records.size} app/test modules, ${checked.size} resolved binary identities verified.")
    }
}

