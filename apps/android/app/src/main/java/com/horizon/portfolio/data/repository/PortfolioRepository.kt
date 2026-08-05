package com.horizon.portfolio.data.repository

import android.util.Log
import com.horizon.portfolio.data.api.PortfolioApiClient
import com.horizon.portfolio.data.cache.DashboardCacheDao
import com.horizon.portfolio.data.cache.DashboardCacheEntity
import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

enum class DashboardSource {
    REMOTE,
    CACHE,
    DEMO,
}

data class DashboardLoadResult(
    val payload: DashboardPayload,
    val source: DashboardSource,
    val warning: String? = null,
)

interface PortfolioRepository {
    suspend fun loadDashboard(): DashboardLoadResult

    suspend fun runAgent(): AgentRun

    suspend fun setMainIndustry(
        market: String,
        symbol: String,
        mainIndustryId: String,
    ): DashboardLoadResult

    suspend fun restoreAutomaticIndustry(
        market: String,
        symbol: String,
    ): DashboardLoadResult
}

class DefaultPortfolioRepository(
    private val api: PortfolioApiClient,
    private val cache: DashboardCacheDao,
    private val json: Json,
) : PortfolioRepository {
    override suspend fun loadDashboard(): DashboardLoadResult {
        return try {
            val payload = api.loadDashboard()
            cache.upsert(
                DashboardCacheEntity(
                    payloadJson = json.encodeToString(payload),
                    cachedAtEpochMillis = System.currentTimeMillis(),
                ),
            )
            Log.i(
                LOG_TAG,
                "Loaded remote dashboard snapshot=${payload.snapshot.id} positions=${payload.snapshot.positions.size}",
            )
            DashboardLoadResult(
                payload = payload,
                source = DashboardSource.REMOTE,
                warning = payload.industryData
                    ?.takeIf { it.status != "fresh" }
                    ?.message,
            )
        } catch (remoteError: Exception) {
            val cached = cache.get()
            if (cached == null) {
                throw IllegalStateException(
                    "无法连接本机后端，请确认 API 正在运行：${remoteError.message}",
                    remoteError,
                )
            }
            val payload = json.decodeFromString<DashboardPayload>(cached.payloadJson)
            Log.w(
                LOG_TAG,
                "Remote dashboard unavailable; using cache snapshot=${payload.snapshot.id}",
                remoteError,
            )
            DashboardLoadResult(
                payload = payload,
                source = DashboardSource.CACHE,
                warning = "后端暂时不可用，当前展示本机缓存。",
            )
        }
    }

    override suspend fun runAgent(): AgentRun = api.runAgent()

    override suspend fun setMainIndustry(
        market: String,
        symbol: String,
        mainIndustryId: String,
    ): DashboardLoadResult {
        api.setMainIndustry(market, symbol, mainIndustryId)
        return loadDashboard()
    }

    override suspend fun restoreAutomaticIndustry(
        market: String,
        symbol: String,
    ): DashboardLoadResult {
        api.restoreAutomaticIndustry(market, symbol)
        return loadDashboard()
    }

    private companion object {
        const val LOG_TAG = "PortfolioData"
    }
}
