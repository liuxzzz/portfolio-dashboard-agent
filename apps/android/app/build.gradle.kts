plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

val configuredApiBaseUrl = providers.gradleProperty("PORTFOLIO_API_BASE_URL")
val configuredApiToken = providers.gradleProperty("PORTFOLIO_API_TOKEN")
    .orElse(providers.environmentVariable("PORTFOLIO_API_TOKEN"))
    .orElse("")

android {
    namespace = "com.horizon.portfolio"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.horizon.portfolio"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    buildTypes {
        debug {
            val debugApiBaseUrl = configuredApiBaseUrl.orElse("http://127.0.0.1:4000")
            buildConfigField("String", "API_BASE_URL", "\"${debugApiBaseUrl.get()}\"")
            buildConfigField("String", "API_TOKEN", "\"${configuredApiToken.get()}\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            val releaseApiBaseUrl = configuredApiBaseUrl.orElse(
                "https://60.205.90.12/maomao-api",
            )
            buildConfigField("String", "API_BASE_URL", "\"${releaseApiBaseUrl.get()}\"")
            buildConfigField("String", "API_TOKEN", "\"${configuredApiToken.get()}\"")
            manifestPlaceholders["usesCleartextTraffic"] =
                releaseApiBaseUrl.get().startsWith("http://").toString()
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    implementation(libs.kotlinx.serialization.json)
    ksp(libs.androidx.room.compiler)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
}
