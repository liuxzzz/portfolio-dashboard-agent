package com.horizon.portfolio.data.repository

import com.horizon.portfolio.domain.model.AgentInsight
import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.domain.model.DashboardPayload
import com.horizon.portfolio.domain.model.EvidenceReference
import com.horizon.portfolio.domain.model.IndustryAllocation
import com.horizon.portfolio.domain.model.PortfolioHistoryPoint
import com.horizon.portfolio.domain.model.PortfolioSnapshot
import com.horizon.portfolio.domain.model.PositionSnapshot

internal object DemoDashboard {
    private const val capturedAt = "2026-08-05T08:30:00.000Z"

    val payload = DashboardPayload(
        snapshot = PortfolioSnapshot(
            id = "demo-snapshot-2026-08-05",
            source = "tzzb",
            sourceAccountId = "demo-account",
            accountName = "防守组合 · 演示数据",
            capturedAt = capturedAt,
            sourceSyncedAt = "2026-08-05T07:58:00.000Z",
            freshness = "fresh",
            totalAsset = 1_286_430.0,
            cash = 42_800.0,
            stockMarketValue = 1_243_630.0,
            dayProfit = 8_420.0,
            dayProfitRate = 0.0066,
            positionRate = 0.9667,
            positions = listOf(
                PositionSnapshot("600519", "示例消费", "SH", "食品饮料", 240.0, 1554.2, 1468.6, 373_008.0, 0.29, 3720.0, 0.0101, 20_544.0, 0.0583, 188),
                PositionSnapshot("601318", "示例金融", "SH", "非银金融", 4300.0, 58.4, 54.1, 251_120.0, 0.1952, -860.0, -0.0034, 18_490.0, 0.0795, 96),
                PositionSnapshot("600036", "示例银行", "SH", "银行", 4900.0, 45.2, 41.8, 221_480.0, 0.1722, 2205.0, 0.0101, 16_660.0, 0.0813, 142),
                PositionSnapshot("600900", "示例公用事业", "SH", "公用事业", 5600.0, 28.7, 27.3, 160_720.0, 0.1249, 1120.0, 0.007, 7_840.0, 0.0513, 73),
                PositionSnapshot("510300", "示例宽基 ETF", "SH", "宽基指数", 26_000.0, 4.385, 4.21, 113_992.0, 0.0886, 525.0, 0.0046, 4_550.0, 0.0416, 67),
            ),
        ),
        industries = listOf(
            IndustryAllocation("食品饮料", 373_008.0, 0.29, "#172033"),
            IndustryAllocation("非银金融", 251_120.0, 0.1952, "#5BC5A7"),
            IndustryAllocation("银行", 221_480.0, 0.1722, "#F3B45A"),
            IndustryAllocation("其他", 398_102.0, 0.3094, "#7C8BE8"),
        ),
        history = listOf(
            PortfolioHistoryPoint("07-28", 1_251_600.0, 0.91),
            PortfolioHistoryPoint("07-29", 1_258_400.0, 0.92),
            PortfolioHistoryPoint("07-30", 1_249_800.0, 0.92),
            PortfolioHistoryPoint("07-31", 1_267_200.0, 0.94),
            PortfolioHistoryPoint("08-01", 1_271_100.0, 0.95),
            PortfolioHistoryPoint("08-04", 1_278_010.0, 0.96),
            PortfolioHistoryPoint("08-05", 1_286_430.0, 0.9667),
        ),
        latestAgentRun = AgentRun(
            id = "run:demo-snapshot-2026-08-05",
            snapshotId = "demo-snapshot-2026-08-05",
            status = "completed",
            requestedAt = capturedAt,
            completedAt = capturedAt,
            insights = listOf(
                AgentInsight(
                    id = "demo:concentration",
                    category = "concentration",
                    severity = "attention",
                    title = "单一持仓集中度较高",
                    summary = "示例消费占组合 29.0%，是当前最大的单一个股暴露。",
                    confidence = 1.0,
                    evidence = listOf(EvidenceReference("position", "600519", "示例消费仓位", capturedAt)),
                    createdAt = capturedAt,
                ),
                AgentInsight(
                    id = "demo:cash",
                    category = "cash",
                    severity = "attention",
                    title = "现金缓冲较低",
                    summary = "现金约占总资产 3.3%。这是流动性事实提示，不代表需要调仓。",
                    confidence = 1.0,
                    evidence = listOf(EvidenceReference("snapshot", "demo-snapshot-2026-08-05", "演示持仓快照", capturedAt)),
                    createdAt = capturedAt,
                ),
            ),
            disclaimer = "以下内容用于整理持仓事实和风险线索，不构成证券选择、买卖时机或收益承诺。",
        ),
    )
}
