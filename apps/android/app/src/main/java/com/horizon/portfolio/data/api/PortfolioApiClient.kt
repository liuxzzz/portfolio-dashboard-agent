package com.horizon.portfolio.data.api

import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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

    private suspend inline fun <reified T> request(
        method: String,
        path: String,
    ): T = withContext(Dispatchers.IO) {
        val connection = URL("$normalizedBaseUrl$path").openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 5_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
            if (method == "POST") {
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(0)
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
}

class PortfolioApiException(
    val status: Int,
    responseBody: String,
) : Exception("Portfolio API 请求失败：HTTP $status${responseBody.takeIf(String::isNotBlank)?.let { " · $it" }.orEmpty()}")
