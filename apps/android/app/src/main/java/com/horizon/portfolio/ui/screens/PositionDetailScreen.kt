package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.domain.model.MainIndustry
import com.horizon.portfolio.domain.model.PortfolioSnapshot
import com.horizon.portfolio.ui.components.MetricCard
import com.horizon.portfolio.ui.components.PageHeader
import com.horizon.portfolio.ui.components.SectionCard
import com.horizon.portfolio.ui.components.formatCurrency
import com.horizon.portfolio.ui.components.formatPercent
import com.horizon.portfolio.ui.components.formatTime
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.MutedDark
import com.horizon.portfolio.ui.theme.Success

@Composable
fun PositionDetailScreen(
    snapshot: PortfolioSnapshot,
    symbol: String,
    mainIndustries: List<MainIndustry>,
    isSavingIndustry: Boolean,
    message: String?,
    onSetMainIndustry: (String, String, String, String) -> Unit,
    onRestoreAutomaticIndustry: (String, String) -> Unit,
    onBack: () -> Unit,
) {
    val position = snapshot.positions.firstOrNull { it.symbol == symbol }
    var showIndustryDialog by rememberSaveable(symbol) { mutableStateOf(false) }
    var selectedIndustryId by rememberSaveable(symbol, position?.mainIndustryId) {
        mutableStateOf(
            position?.mainIndustryId
                ?: mainIndustries.firstOrNull { it.name == position?.industry }?.id,
        )
    }

    if (showIndustryDialog && position != null) {
        AlertDialog(
            onDismissRequest = { if (!isSavingIndustry) showIndustryDialog = false },
            title = { Text("选择我的主行业") },
            text = {
                Column {
                    Text(
                        "你的选择会覆盖数据源分类，并立即用于首页行业聚合。",
                        color = MutedDark,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 10.dp),
                    )
                    mainIndustries.sortedBy { it.sortOrder }.forEach { industry ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !isSavingIndustry) {
                                    selectedIndustryId = industry.id
                                }
                                .padding(vertical = 5.dp),
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selectedIndustryId == industry.id,
                                onClick = { selectedIndustryId = industry.id },
                                enabled = !isSavingIndustry,
                            )
                            Text(
                                industry.name,
                                color = Ink,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(start = 6.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = selectedIndustryId != null && !isSavingIndustry,
                    onClick = {
                        val selected = mainIndustries.firstOrNull {
                            it.id == selectedIndustryId
                        } ?: return@TextButton
                        onSetMainIndustry(
                            position.market,
                            position.symbol,
                            selected.id,
                            selected.name,
                        )
                        showIndustryDialog = false
                    },
                ) {
                    Text("保存")
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isSavingIndustry,
                    onClick = { showIndustryDialog = false },
                ) {
                    Text("取消")
                }
            },
        )
    }

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

        SectionCard(
            title = "我的主行业",
            subtitle = if (position.industryCustomized) {
                "手动分类优先于数据源，并用于首页行业聚合"
            } else {
                "当前使用数据源自动分类"
            },
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        position.industry ?: "未分类",
                        color = Ink,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    Text(
                        "数据源分类：${position.sourceIndustry ?: "暂无"}",
                        color = MutedDark,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
                if (isSavingIndustry) {
                    CircularProgressIndicator(Modifier.size(24.dp))
                } else {
                    OutlinedButton(
                        enabled = mainIndustries.isNotEmpty(),
                        onClick = { showIndustryDialog = true },
                    ) {
                        Text("修改")
                    }
                }
            }
            if (position.industryCustomized) {
                TextButton(
                    enabled = !isSavingIndustry,
                    onClick = {
                        onRestoreAutomaticIndustry(position.market, position.symbol)
                    },
                    modifier = Modifier.padding(top = 5.dp),
                ) {
                    Text("恢复自动分类")
                }
            }
            message?.takeIf(String::isNotBlank)?.let {
                Text(
                    it,
                    color = Success,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 7.dp),
                )
            }
        }

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
