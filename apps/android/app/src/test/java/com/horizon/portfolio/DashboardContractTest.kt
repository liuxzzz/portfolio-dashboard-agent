package com.horizon.portfolio

import com.horizon.portfolio.domain.model.DashboardPayload
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class DashboardContractTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `decodes backend dashboard contract`() {
        val payload = json.decodeFromString<DashboardPayload>(fixture)

        assertEquals("snapshot-contract", payload.snapshot.id)
        assertEquals("600000", payload.snapshot.positions.single().symbol)
        assertEquals("attention", payload.latestAgentRun?.insights?.single()?.severity)
        assertNotNull(payload.latestAgentRun?.insights?.single()?.evidence?.single())
    }

    private companion object {
        val fixture = """
            {
              "snapshot": {
                "id": "snapshot-contract",
                "source": "tzzb",
                "sourceAccountId": "account-contract",
                "accountName": "接口契约测试",
                "capturedAt": "2026-08-05T08:30:00.000Z",
                "sourceSyncedAt": "2026-08-05T08:00:00.000Z",
                "freshness": "fresh",
                "currency": "CNY",
                "totalAsset": 100000,
                "cash": 20000,
                "stockMarketValue": 80000,
                "dayProfit": 300,
                "dayProfitRate": 0.003,
                "positionRate": 0.8,
                "positions": [{
                  "symbol": "600000",
                  "name": "示例股份",
                  "market": "SH",
                  "industry": "金融",
                  "quantity": 2000,
                  "currentPrice": 40,
                  "unitCost": 35,
                  "marketValue": 80000,
                  "portfolioWeight": 0.8,
                  "dayProfit": 300,
                  "dayProfitRate": 0.0038,
                  "holdingProfit": 10000,
                  "holdingProfitRate": 0.1429,
                  "holdingDays": 100
                }]
              },
              "industries": [{"name":"金融","value":80000,"weight":0.8,"color":"#172033"}],
              "history": [{"date":"2026-08-05","totalAsset":100000,"positionRate":0.8}],
              "latestAgentRun": {
                "id": "run-contract",
                "snapshotId": "snapshot-contract",
                "status": "completed",
                "requestedAt": "2026-08-05T09:00:00.000Z",
                "completedAt": "2026-08-05T09:00:00.000Z",
                "model": null,
                "insights": [{
                  "id": "insight-contract",
                  "category": "concentration",
                  "severity": "attention",
                  "title": "集中度提示",
                  "summary": "示例摘要",
                  "confidence": 1,
                  "evidence": [{
                    "kind": "position",
                    "referenceId": "600000",
                    "label": "示例股份仓位",
                    "asOf": "2026-08-05T08:30:00.000Z"
                  }],
                  "createdAt": "2026-08-05T09:00:00.000Z"
                }],
                "disclaimer": "不构成投资建议。"
              }
            }
        """.trimIndent()
    }
}
