import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.inputStream().use(localProperties::load)
}

android {
    namespace = "id.absensiplus.app"
    compileSdk = 35

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    kotlin {
        jvmToolchain(17)
    }

    defaultConfig {
        applicationId = "id.absensiplus.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField(
            "String",
            "SUPABASE_URL",
            "\"${localProperties.getProperty("supabase.url", "")}\"",
        )
        buildConfigField(
            "String",
            "SUPABASE_ANON_KEY",
            "\"${localProperties.getProperty("supabase.anon_key", "")}\"",
        )
    }
    buildFeatures { buildConfig = true }
}

configurations.all {
    resolutionStrategy.eachDependency {
        if (requested.group == "io.ktor") {
            useVersion("3.1.3")
        }
        if (requested.group == "org.jetbrains.kotlinx" &&
            requested.name.startsWith("kotlinx-serialization-")
        ) {
            useVersion("1.8.1")
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.01.00"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("io.github.jan-tennert.supabase:postgrest-kt:3.2.0")
    implementation("io.github.jan-tennert.supabase:auth-kt:3.2.0")
    implementation("io.github.jan-tennert.supabase:realtime-kt:3.2.0")
    implementation("io.ktor:ktor-client-android:3.1.3")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
