package com.horizon.portfolio.data.auth

import com.horizon.portfolio.data.api.PortfolioApiClient
import com.horizon.portfolio.data.api.PortfolioApiException
import com.horizon.portfolio.data.cache.DashboardCacheDao

interface AuthRepository {
    suspend fun requestCode(phone: String): Int

    suspend fun login(phone: String, code: String)

    suspend fun logout()
}

class DefaultAuthRepository(
    private val api: PortfolioApiClient,
    private val sessionStore: AuthSessionStore,
    private val cache: DashboardCacheDao,
) : AuthRepository {
    override suspend fun requestCode(phone: String): Int = try {
        api.requestSmsCode(phone).retryAfterSeconds
    } catch (error: PortfolioApiException) {
        throw friendlyError(error)
    }

    override suspend fun login(phone: String, code: String) {
        try {
            val session = api.login(phone, code)
            cache.clear()
            sessionStore.save(
                accessToken = session.accessToken,
                expiresAt = session.expiresAt,
                user = AuthUser(session.user.id, session.user.phone),
            )
        } catch (error: PortfolioApiException) {
            throw friendlyError(error)
        }
    }

    override suspend fun logout() {
        try {
            api.logout()
        } catch (_: Exception) {
            // Local logout must still complete if the session already expired or the API is offline.
        } finally {
            cache.clear()
            sessionStore.clear()
        }
    }

    private fun friendlyError(error: PortfolioApiException): Exception {
        val message = when {
            error.status == 429 -> "验证码发送太频繁，请稍后再试。"
            error.status == 503 -> "短信服务暂时不可用，请稍后再试。"
            "invalid_phone" in error.responseBody -> "请输入正确的中国大陆手机号。"
            "invalid_or_expired_code" in error.responseBody -> "验证码错误或已过期。"
            else -> "登录请求失败，请检查网络后重试。"
        }
        return IllegalStateException(message, error)
    }
}
