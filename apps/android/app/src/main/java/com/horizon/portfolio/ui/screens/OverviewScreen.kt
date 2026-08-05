package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.data.repository.DashboardSource
import com.horizon.portfolio.ui.DashboardUiState
import com.horizon.portfolio.ui.components.AllocationBar
import com.horizon.portfolio.ui.components.MetricCard
import com.horizon.portfolio.ui.components.PageHeader
import com.horizon.portfolio.ui.components.SectionCard
import com.horizon.portfolio.ui.components.SourceBadge
import com.horizon.portfolio.ui.components.Sparkline
import com.horizon.portfolio.ui.components.formatCurrency
import com.horizon.portfolio.ui.components.formatPercent
import com.horizon.portfolio.ui.components.formatTime
import com.horizon.portfolio.ui.theme.Accent
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.Negative
import com.horizon.portfolio.ui.theme.Positive

@Composable
fun OverviewScreen(
    state: DashboardUiState,
    onRefresh: () -> Unit,
) {
    val dashboard = requireNotNull(state.dashboard)
    val snapshot = dashboard.snapshot
    val topPositions = snapshot.positions.sortedByDescending { it.marketValue }.take(5)
    val sourceLabel = when (state.source) {
        DashboardSource.REMOTE -> if (snapshot.freshness == "fresh") "实时快照" else "数据待同步"
        DashboardSource.CACHE -> "本机缓存"
        DashboardSource.DEMO -> "演示数据"
        null -> "加载中"
    }

    LazyColumn(
        modifier = Modifier.background(Canvas),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                PageHeader(
                    eyebrow = "PORTFOLIO / TODAY",
                    title = "组合概览",
                    subtitle = snapshot.accountName,
                    modifier = Modifier.weight(1f),
                )
                SourceBadge(sourceLabel)
            }
        }

        state.message?.let { message ->
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFFF2D8), RoundedCornerShape(14.dp))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(message, color = Ink, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Button(onClick = onRefresh, enabled = !state.isLoading) { Text("重试") }
                }
            }
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Ink, RoundedCornerShape(24.dp))
                    .padding(24.dp),
            ) {
                Text("总资产", color = Color(0xFFAEB7C7), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(
                    formatCurrency(snapshot.totalAsset),
                    color = Color.White,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 7.dp),
                )
                Text(
                    "今日 ${formatCurrency(snapshot.dayProfit, true)} · ${formatPercent(snapshot.dayProfitRate, true)}",
                    color = if ((snapshot.dayProfit ?: 0.0) >= 0) Positive else Negative,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 18.dp),
                )
                Sparkline(dashboard.history.map { it.totalAsset }, Modifier.padding(top = 18.dp))
                Text(
                    "源数据同步于 ${formatTime(snapshot.sourceSyncedAt)}",
                    color = Color(0xFF8C98AB),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard(
                    label = "股票市值",
                    value = formatCurrency(snapshot.stockMarketValue),
                    note = "${snapshot.positions.size} 只持仓",
                    modifier = Modifier.weight(1f),
                )
                MetricCard(
                    label = "股票仓位",
                    value = formatPercent(snapshot.positionRate),
                    note = "按净资产计算",
                    modifier = Modifier.weight(1f),
                )
            }
        }

        item {
            MetricCard(
                label = "现金",
                value = formatCurrency(snapshot.cash),
                note = "${formatPercent(if (snapshot.totalAsset == 0.0) 0.0 else snapshot.cash / snapshot.totalAsset)} 现金占比",
                modifier = Modifier.fillMaxWidth(),
            )
        }

        item {
            SectionCard(title = "行业分布", subtitle = "按最新市值") {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    dashboard.industries.forEach { allocation ->
                        AllocationBar(allocation.name, allocation.weight, color = parseColor(allocation.color))
                    }
                }
            }
        }

        item {
            SectionCard(title = "个股集中度", subtitle = "前五大持仓") {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    topPositions.forEach { position ->
                        AllocationBar(position.name, position.portfolioWeight ?: 0.0, Accent)
                    }
                }
            }
        }

        item {
            Text(
                "本页先展示数据事实。所有分析都必须引用快照时间和证据，不直接生成交易指令。",
                color = Muted,
                fontSize = 11.sp,
                lineHeight = 18.sp,
                modifier = Modifier.padding(4.dp),
            )
        }
    }
}

private fun parseColor(value: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(value))
}.getOrDefault(Accent)
