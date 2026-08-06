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
import com.horizon.portfolio.domain.model.IndustryTag
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
    amountsVisible: Boolean,
    industryTags: List<IndustryTag>,
    isSavingTag: Boolean,
    message: String?,
    onSetIndustryTag: (String, String, String, String) -> Unit,
    onRestoreAutomaticIndustry: (String, String) -> Unit,
    onBack: () -> Unit,
) {
    val position = snapshot.positions.firstOrNull { it.symbol == symbol }
    var showTagDialog by rememberSaveable(symbol) { mutableStateOf(false) }
    var selectedTagId by rememberSaveable(symbol, position?.industryTagId) {
        mutableStateOf(
            position?.industryTagId
                ?: industryTags.firstOrNull { it.name == position?.industry }?.id,
        )
    }

    if (showTagDialog && position != null) {
        AlertDialog(
            onDismissRequest = { if (!isSavingTag) showTagDialog = false },
            title = { Text("选择行业标签") },
            text = {
                Column {
                    Text(
                        "标签会覆盖数据源自动行业，并立即用于首页行业聚合。",
                        color = MutedDark,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 10.dp),
                    )
                    industryTags.sortedBy { it.sortOrder }.forEach { tag ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !isSavingTag) {
                                    selectedTagId = tag.id
                                }
                                .padding(vertical = 5.dp),
                            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selectedTagId == tag.id,
                                onClick = { selectedTagId = tag.id },
                                enabled = !isSavingTag,
                            )
                            Text(
                                tag.name,
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
                    enabled = selectedTagId != null && !isSavingTag,
                    onClick = {
                        val selected = industryTags.firstOrNull {
                            it.id == selectedTagId
                        } ?: return@TextButton
                        onSetIndustryTag(
                            position.market,
                            position.symbol,
                            selected.id,
                            selected.name,
                        )
                        showTagDialog = false
                    },
                ) {
                    Text("保存")
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isSavingTag,
                    onClick = { showTagDialog = false },
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
            title = "我的行业标签",
            subtitle = if (position.industryTagged) {
                "用户标签优先于数据源，并用于首页行业聚合"
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
                if (isSavingTag) {
                    CircularProgressIndicator(Modifier.size(24.dp))
                } else {
                    OutlinedButton(
                        enabled = industryTags.isNotEmpty(),
                        onClick = { showTagDialog = true },
                    ) {
                        Text(if (industryTags.isEmpty()) "请先创建标签" else "修改")
                    }
                }
            }
            if (position.industryTagged) {
                TextButton(
                    enabled = !isSavingTag,
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
                formatCurrency(position.currentPrice, visible = amountsVisible),
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
                formatCurrency(position.marketValue, visible = amountsVisible),
                formatPercent(position.portfolioWeight),
                Modifier.weight(1f),
            )
            MetricCard(
                "持有盈亏",
                formatCurrency(position.holdingProfit, true, amountsVisible),
                formatPercent(position.holdingProfitRate, true),
                Modifier.weight(1f),
            )
        }
        MetricCard(
            "单位成本",
            formatCurrency(position.unitCost, visible = amountsVisible),
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
