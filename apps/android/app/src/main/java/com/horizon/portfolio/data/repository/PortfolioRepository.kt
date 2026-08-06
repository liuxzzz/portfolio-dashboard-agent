package com.horizon.portfolio.data.repository

import android.util.Log
import com.horizon.portfolio.data.api.PortfolioApiClient
import com.horizon.portfolio.data.api.PortfolioApiException
import com.horizon.portfolio.data.auth.AuthSessionStore
import com.horizon.portfolio.data.cache.DashboardCacheDao
import com.horizon.portfolio.data.cache.DashboardCacheEntity
import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
import com.horizon.portfolio.domain.model.IndustryTag
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

    suspend fun loadIndustryTags(): List<IndustryTag>

    suspend fun createIndustryTag(name: String, color: String): IndustryTag

    suspend fun deleteIndustryTag(tagId: String)

    suspend fun setIndustryTag(
        market: String,
        symbol: String,
        tagId: String,
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
    private val sessionStore: AuthSessionStore,
) : PortfolioRepository {
    override suspend fun loadDashboard(): DashboardLoadResult {
        val session = sessionStore.session.value
            ?: throw IllegalStateException("请先登录。")
        return try {
            val payload = api.loadDashboard()
            cache.upsert(
                DashboardCacheEntity(
                    ownerUserId = session.user.id,
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
            if (remoteError is PortfolioApiException && remoteError.status == 401) {
                cache.clear()
                sessionStore.clear()
                throw IllegalStateException("登录已过期，请重新登录。", remoteError)
            }
            val cached = cache.get(session.user.id)
            if (cached == null) {
                if (remoteError is PortfolioApiException && remoteError.status == 404) {
                    throw IllegalStateException(
                        "暂无组合数据。行业标签仍可管理，采集完成后请重新加载。",
                        remoteError,
                    )
                }
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

    override suspend fun loadIndustryTags(): List<IndustryTag> = api.loadIndustryTags()

    override suspend fun createIndustryTag(
        name: String,
        color: String,
    ): IndustryTag {
        return try {
            api.createIndustryTag(name, color)
        } catch (error: PortfolioApiException) {
            if (error.status == 409) {
                throw IllegalStateException("标签名称已存在。", error)
            }
            throw error
        }
    }

    override suspend fun deleteIndustryTag(tagId: String) {
        api.deleteIndustryTag(tagId)
    }

    override suspend fun setIndustryTag(
        market: String,
        symbol: String,
        tagId: String,
    ): DashboardLoadResult {
        api.setIndustryTag(market, symbol, tagId)
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
