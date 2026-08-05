package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.domain.model.PortfolioSnapshot
import com.horizon.portfolio.ui.components.MetricCard
import com.horizon.portfolio.ui.components.PageHeader
import com.horizon.portfolio.ui.components.formatCurrency
import com.horizon.portfolio.ui.components.formatPercent
import com.horizon.portfolio.ui.components.formatTime
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.MutedDark

@Composable
fun PositionDetailScreen(
    snapshot: PortfolioSnapshot,
    symbol: String,
    onBack: () -> Unit,
) {
    val position = snapshot.positions.firstOrNull { it.symbol == symbol }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Canvas)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Button(onClick = onBack) { Text("返回") }
        if (position == null) {
            Text("没有找到这条持仓", color = Ink, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold)
            return@Column
        }

        PageHeader(
            eyebrow = "${position.market} · ${position.symbol}",
            title = position.name,
            subtitle = position.industry ?: "未分类行业",
        )

        Column(
            modifier = Modifier.fillMaxWidth().background(Ink, RoundedCornerShape(24.dp)).padding(24.dp),
        ) {
            Text("最新价", color = Color(0xFFAEB7C7), fontSize = 12.sp)
            Text(
                formatCurrency(position.currentPrice),
                color = Color.White,
                fontSize = 34.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 7.dp),
            )
            Text(
                "快照时间 ${formatTime(snapshot.capturedAt)}",
                color = Color(0xFF8C98AB),
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 18.dp),
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MetricCard(
                "持有金额",
                formatCurrency(position.marketValue),
                formatPercent(position.portfolioWeight),
                Modifier.weight(1f),
            )
            MetricCard(
                "持有盈亏",
                formatCurrency(position.holdingProfit, true),
                formatPercent(position.holdingProfitRate, true),
                Modifier.weight(1f),
            )
        }
        MetricCard(
            "单位成本",
            formatCurrency(position.unitCost),
            "${position.holdingDays ?: "—"} 个持仓日",
            Modifier.fillMaxWidth(),
        )
        position.relatedSector?.let { sector ->
            MetricCard(
                "申万细分行业",
                sector,
                "行业当日 ${formatPercent(position.sectorRate, true)}",
                Modifier.fillMaxWidth(),
            )
        }

        Column(
            modifier = Modifier.fillMaxWidth().background(AccentSoft, RoundedCornerShape(18.dp)).padding(18.dp),
        ) {
            Text("数据证据", color = Ink, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
            Text(
                "数量、成本和持仓天数来自账户持仓接口；最新价来自行情接口；市值、仓位和盈亏由标准化计算层生成。",
                color = MutedDark,
                fontSize = 12.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 7.dp),
            )
        }
    }
}
