package com.horizon.portfolio

import android.app.Application
import com.horizon.portfolio.data.api.PortfolioApiClient
import com.horizon.portfolio.data.cache.PortfolioDatabase
import com.horizon.portfolio.data.repository.DefaultPortfolioRepository
import com.horizon.portfolio.data.repository.PortfolioRepository
import kotlinx.serialization.json.Json

class PortfolioApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

class AppContainer(application: Application) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }
    private val database = PortfolioDatabase.create(application)
    private val api = PortfolioApiClient(BuildConfig.API_BASE_URL, json)

    val portfolioRepository: PortfolioRepository = DefaultPortfolioRepository(
        api = api,
        cache = database.dashboardCacheDao(),
        json = json,
    )
}
