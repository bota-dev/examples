plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "dev.bota.examples.connect"
    compileSdk = 36
    defaultConfig {
        applicationId = "dev.bota.examples.kotlinconnect"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencyLocking { lockAllConfigurations() }
dependencies {
    implementation("dev.bota:bota-app-sdk:2.0.0-beta.9")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
