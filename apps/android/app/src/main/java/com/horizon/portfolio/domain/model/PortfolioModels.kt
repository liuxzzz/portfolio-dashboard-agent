package com.horizon.portfolio.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class DashboardPayload(
    val snapshot: PortfolioSnapshot,
    val industries: List<IndustryAllocation>,
    val history: List<PortfolioHistoryPoint>,
    val latestAgentRun: AgentRun? = null,
)

@Serializable
data class PortfolioSnapshot(
    val id: String,
    val source: String,
    val sourceAccountId: String,
    val accountName: String,
    val capturedAt: String,
    val sourceSyncedAt: String? = null,
    val freshness: String,
    val currency: String = "CNY",
    val totalAsset: Double,
    val cash: Double,
    val stockMarketValue: Double,
    val dayProfit: Double? = null,
    val dayProfitRate: Double? = null,
    val positionRate: Double? = null,
    val positions: List<PositionSnapshot>,
)

@Serializable
data class PositionSnapshot(
    val symbol: String,
    val name: String,
    val market: String,
    val industry: String? = null,
    val quantity: Double,
    val currentPrice: Double? = null,
    val unitCost: Double? = null,
    val marketValue: Double,
    val portfolioWeight: Double? = null,
    val dayProfit: Double? = null,
    val dayProfitRate: Double? = null,
    val holdingProfit: Double? = null,
    val holdingProfitRate: Double? = null,
    val holdingDays: Int? = null,
)

@Serializable
data class IndustryAllocation(
    val name: String,
    val value: Double,
    val weight: Double,
    val color: String,
)

@Serializable
data class PortfolioHistoryPoint(
    val date: String,
    val totalAsset: Double,
    val positionRate: Double? = null,
)

@Serializable
data class AgentRun(
    val id: String,
    val snapshotId: String,
    val status: String,
    val requestedAt: String,
    val completedAt: String? = null,
    val model: String? = null,
    val insights: List<AgentInsight>,
    val disclaimer: String,
)

@Serializable
data class AgentInsight(
    val id: String,
    val category: String,
    val severity: String,
    val title: String,
    val summary: String,
    val confidence: Double,
    val evidence: List<EvidenceReference>,
    val createdAt: String,
)

@Serializable
data class EvidenceReference(
    val kind: String,
    val referenceId: String,
    val label: String,
    val asOf: String,
)
