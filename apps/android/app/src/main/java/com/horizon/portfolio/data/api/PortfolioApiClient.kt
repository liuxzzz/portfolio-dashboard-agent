package com.horizon.portfolio.data.api

import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
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
    private val json: Json,
) {
    private val normalizedBaseUrl = baseUrl.trimEnd('/')

    suspend fun loadDashboard(): DashboardPayload = request(
        method = "GET",
        path = "/v1/dashboard",
    )

    suspend fun runAgent(): AgentRun = request(
        method = "POST",
        path = "/v1/agent/runs",
    )

    suspend fun setMainIndustry(
        market: String,
        symbol: String,
        mainIndustryId: String,
    ): IndustryOverrideResponse = request(
        method = "PUT",
        path = "/v1/positions/${encode(market)}/${encode(symbol)}/main-industry",
        body = json.encodeToString(IndustryOverrideRequest(mainIndustryId)),
    )

    suspend fun restoreAutomaticIndustry(
        market: String,
        symbol: String,
    ): RestoreIndustryResponse = request(
        method = "DELETE",
        path = "/v1/positions/${encode(market)}/${encode(symbol)}/main-industry",
    )

    private suspend inline fun <reified T> request(
        method: String,
        path: String,
        body: String? = null,
    ): T = withContext(Dispatchers.IO) {
        val connection = URL("$normalizedBaseUrl$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 5_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
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
private data class IndustryOverrideRequest(val mainIndustryId: String)

@Serializable
data class IndustryOverrideResponse(
    val market: String,
    val symbol: String,
    val mainIndustryId: String,
    val mainIndustryName: String,
)

@Serializable
data class RestoreIndustryResponse(val restored: Boolean)

class PortfolioApiException(
    val status: Int,
    responseBody: String,
) : Exception("Portfolio API 请求失败：HTTP $status${responseBody.takeIf(String::isNotBlank)?.let { " · $it" }.orEmpty()}")
