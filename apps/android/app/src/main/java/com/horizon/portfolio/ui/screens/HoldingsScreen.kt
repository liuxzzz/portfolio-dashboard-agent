package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.domain.model.PortfolioSnapshot
import com.horizon.portfolio.ui.components.PageHeader
import com.horizon.portfolio.ui.components.formatCurrency
import com.horizon.portfolio.ui.components.formatPercent
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.MarketDown
import com.horizon.portfolio.ui.theme.MarketUp

@Composable
fun HoldingsScreen(
    snapshot: PortfolioSnapshot,
    amountsVisible: Boolean,
    onPositionClick: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.background(Canvas),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            PageHeader("POSITIONS", "全部持仓", "按最新市值排序 · 点击查看证据详情")
        }
        items(
            items = snapshot.positions.sortedByDescending { it.marketValue },
            key = { it.symbol },
        ) { position ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable { onPositionClick(position.symbol) },
                colors = CardDefaults.cardColors(),
                border = CardDefaults.outlinedCardBorder(),
                shape = RoundedCornerShape(18.dp),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier.size(48.dp).background(Canvas, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(position.symbol.takeLast(4), color = Ink, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                    }
                    Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                        Text(position.name, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                        Text(
                            "${position.industry ?: "未分类"} · ${formatPercent(position.portfolioWeight)}",
                            color = Muted,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 5.dp),
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            formatCurrency(position.marketValue, visible = amountsVisible),
                            color = Ink,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            formatPercent(position.dayProfitRate, true),
                            color = if ((position.dayProfit ?: 0.0) >= 0) MarketUp else MarketDown,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 5.dp),
                        )
                    }
                }
            }
        }
    }
}
