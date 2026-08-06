package com.horizon.portfolio.data.api

import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
import com.horizon.portfolio.domain.model.IndustryTag
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class PortfolioApiClient(
    baseUrl: String,
    private val accessToken: () -> String?,
    private val onUnauthorized: () -> Unit,
    private val json: Json,
) {
    private val normalizedBaseUrl = baseUrl.trimEnd('/')

    suspend fun requestSmsCode(phone: String): SmsCodeResponse = request(
        method = "POST",
        path = "/v1/auth/sms-codes",
        body = json.encodeToString(SmsCodeRequest(phone)),
        authenticated = false,
    )

    suspend fun login(phone: String, code: String): LoginResponse = request(
        method = "POST",
        path = "/v1/auth/sessions",
        body = json.encodeToString(LoginRequest(phone, code)),
        authenticated = false,
    )

    suspend fun logout(): LogoutResponse = request(
        method = "DELETE",
        path = "/v1/auth/session",
    )

    suspend fun loadDashboard(): DashboardPayload = request(
        method = "GET",
        path = "/v1/dashboard",
    )

    suspend fun runAgent(): AgentRun = request(
        method = "POST",
        path = "/v1/agent/runs",
    )

    suspend fun loadIndustryTags(): List<IndustryTag> = request(
        method = "GET",
        path = "/v1/industry-tags",
    )

    suspend fun createIndustryTag(name: String, color: String): IndustryTag = request(
        method = "POST",
        path = "/v1/industry-tags",
        body = json.encodeToString(CreateIndustryTagRequest(name, color)),
    )

    suspend fun deleteIndustryTag(tagId: String): DeleteIndustryTagResponse = request(
        method = "DELETE",
        path = "/v1/industry-tags/${encode(tagId)}",
    )

    suspend fun setIndustryTag(
        market: String,
        symbol: String,
        tagId: String,
    ): IndustryTagAssignmentResponse = request(
        method = "PUT",
        path = "/v1/positions/${encode(market)}/${encode(symbol)}/industry-tag",
        body = json.encodeToString(IndustryTagAssignmentRequest(tagId)),
    )

    suspend fun restoreAutomaticIndustry(
        market: String,
        symbol: String,
    ): RestoreIndustryResponse = request(
        method = "DELETE",
        path = "/v1/positions/${encode(market)}/${encode(symbol)}/industry-tag",
    )

    private suspend inline fun <reified T> request(
        method: String,
        path: String,
        body: String? = null,
        authenticated: Boolean = true,
    ): T = withContext(Dispatchers.IO) {
        val connection = URL("$normalizedBaseUrl$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 5_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
            val token = accessToken()
            if (authenticated && !token.isNullOrBlank()) {
                connection.setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null || method == "POST") {
                connection.doOutput = true
                val bytes = body?.toByteArray(StandardCharsets.UTF_8) ?: byteArrayOf()
                connection.setFixedLengthStreamingMode(bytes.size)
                if (body != null) {
                    connection.setRequestProperty("Content-Type", "application/json")
                }
                connection.outputStream.use { output -> output.write(bytes) }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                if (authenticated && status == 401) onUnauthorized()
                throw PortfolioApiException(status, responseBody.take(500))
            }
            json.decodeFromString<T>(responseBody)
        } finally {
            connection.disconnect()
        }
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.name())
}

@Serializable
private data class SmsCodeRequest(val phone: String)

@Serializable
private data class LoginRequest(val phone: String, val code: String)

@Serializable
data class SmsCodeResponse(
    val sent: Boolean,
    val retryAfterSeconds: Int,
)

@Serializable
data class LoginResponse(
    val accessToken: String,
    val expiresAt: String,
    val user: ApiAuthUser,
)

@Serializable
data class ApiAuthUser(
    val id: String,
    val phone: String,
)

@Serializable
data class LogoutResponse(val loggedOut: Boolean)

@Serializable
private data class CreateIndustryTagRequest(val name: String, val color: String)

@Serializable
private data class IndustryTagAssignmentRequest(val tagId: String)

@Serializable
data class IndustryTagAssignmentResponse(
    val market: String,
    val symbol: String,
    val tagId: String,
    val tagName: String,
)

@Serializable
data class DeleteIndustryTagResponse(val deleted: Boolean)

@Serializable
data class RestoreIndustryResponse(val restored: Boolean)

class PortfolioApiException(
    val status: Int,
    val responseBody: String,
) : Exception("Portfolio API 请求失败：HTTP $status${responseBody.takeIf(String::isNotBlank)?.let { " · $it" }.orEmpty()}")
