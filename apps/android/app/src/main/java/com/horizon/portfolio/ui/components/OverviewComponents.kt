package com.horizon.portfolio.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.R
import com.horizon.portfolio.domain.model.IndustryAllocation
import com.horizon.portfolio.domain.model.PositionSnapshot
import com.horizon.portfolio.ui.theme.Accent
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Border
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.MutedDark
import com.horizon.portfolio.ui.theme.MarketDownOnDark
import com.horizon.portfolio.ui.theme.MarketUpOnDark
import com.horizon.portfolio.ui.theme.Surface as SurfaceColor
import com.horizon.portfolio.ui.theme.Warning
import com.horizon.portfolio.ui.theme.WarningSoft
import kotlinx.coroutines.delay
import kotlin.math.min

private val OverviewCardShape = RoundedCornerShape(24.dp)
private val HeroStart = Color(0xFF152033)
private val HeroEnd = Color(0xFF1E2C43)
private val HeroMuted = Color(0xFF9EABC0)
private val Indigo = Color(0xFF7887ED)
private val Gold = Color(0xFFF2B35C)

@Composable
fun OverviewReveal(
    animationKey: String,
    delayMillis: Int,
    playAnimation: Boolean,
    content: @Composable () -> Unit,
) {
    if (!playAnimation) {
        content()
        return
    }

    var visible by remember(animationKey) { mutableStateOf(false) }

    LaunchedEffect(animationKey) {
        delay(delayMillis.toLong())
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(420)) + slideInVertically(
            animationSpec = tween(520, easing = FastOutSlowInEasing),
            initialOffsetY = { it / 5 },
        ),
    ) {
        content()
    }
}

@Composable
fun OverviewHeader(
    accountName: String,
    sourceLabel: String,
    amountsVisible: Boolean,
    onToggleAmountsVisibility: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                text = "组合概览",
                color = Ink,
                fontSize = 32.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.6).sp,
                modifier = Modifier.weight(1f),
            )

            IconButton(
                onClick = onToggleAmountsVisibility,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(SurfaceColor)
                    .border(1.dp, Border, CircleShape),
            ) {
                Icon(
                    painter = painterResource(
                        if (amountsVisible) {
                            R.drawable.ic_visibility_rounded
                        } else {
                            R.drawable.ic_visibility_off_rounded
                        },
                    ),
                    contentDescription = if (amountsVisible) "隐藏金额" else "显示金额",
                    tint = Ink,
                    modifier = Modifier.size(21.dp),
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = accountName,
                color = MutedDark,
                fontSize = 14.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(12.dp))
            SourceStatusBadge(sourceLabel)
        }
    }
}

@Composable
private fun SourceStatusBadge(label: String) {
    Row(
        modifier = Modifier
            .background(AccentSoft, RoundedCornerShape(99.dp))
            .padding(horizontal = 11.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(Modifier.size(7.dp).background(Accent, CircleShape))
        Text(label, color = Ink, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun OverviewMessageBanner(
    message: String?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
) {
    AnimatedVisibility(visible = message != null) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .animateContentSize()
                .background(WarningSoft, RoundedCornerShape(18.dp))
                .padding(start = 14.dp, top = 12.dp, end = 8.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(Color.White.copy(alpha = 0.72f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_info_rounded),
                    contentDescription = null,
                    tint = Warning,
                    modifier = Modifier.size(18.dp),
                )
            }
            Text(
                text = message.orEmpty(),
                color = Ink,
                fontSize = 12.sp,
                lineHeight = 18.sp,
                modifier = Modifier.weight(1f).padding(horizontal = 11.dp),
            )
            IconButton(onClick = onRefresh, enabled = !isLoading, modifier = Modifier.size(40.dp)) {
                Icon(
                    painter = painterResource(R.drawable.ic_refresh_rounded),
                    contentDescription = "重试",
                    tint = Ink,
                    modifier = Modifier.size(19.dp),
                )
            }
        }
    }
}

@Composable
fun PortfolioHeroCard(
    totalAsset: Double,
    dayProfitRate: Double?,
    capturedAt: String,
    animationKey: String,
    playAnimation: Boolean,
    amountsVisible: Boolean,
) {
    val isPositive = (dayProfitRate ?: 0.0) >= 0.0
    val profitColor = if (isPositive) MarketUpOnDark else MarketDownOnDark

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(OverviewCardShape)
            .background(Brush.linearGradient(listOf(HeroStart, HeroEnd)))
            .padding(22.dp),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            drawCircle(
                color = Accent.copy(alpha = 0.06f),
                radius = size.width * 0.48f,
                center = Offset(size.width * 0.92f, -size.height * 0.08f),
            )
        }
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(11.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        painter = painterResource(R.drawable.ic_wallet_rounded),
                        contentDescription = null,
                        tint = Accent,
                        modifier = Modifier.size(19.dp),
                    )
                }
                Text(
                    text = "总资产",
                    color = HeroMuted,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }

            AnimatedCurrencyText(
                value = totalAsset,
                animationKey = animationKey,
                playAnimation = playAnimation,
                amountsVisible = amountsVisible,
                modifier = Modifier.padding(top = 14.dp),
            )

            Row(
                modifier = Modifier.padding(top = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .background(profitColor.copy(alpha = 0.13f), RoundedCornerShape(99.dp))
                        .padding(horizontal = 10.dp, vertical = 7.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            painter = painterResource(R.drawable.ic_trending_up_rounded),
                            contentDescription = null,
                            tint = profitColor,
                            modifier = Modifier
                                .size(16.dp)
                                .graphicsLayer { rotationZ = if (isPositive) 0f else 90f },
                        )
                        Text(
                            text = "今日涨幅 ${formatPercent(dayProfitRate, true)}",
                            color = profitColor,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(start = 5.dp),
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.padding(top = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_schedule_rounded),
                    contentDescription = null,
                    tint = HeroMuted,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    text = "数据获取于 ${formatTime(capturedAt)}",
                    color = HeroMuted,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun AnimatedCurrencyText(
    value: Double,
    animationKey: String,
    playAnimation: Boolean,
    amountsVisible: Boolean,
    modifier: Modifier = Modifier,
) {
    val animated = remember(animationKey, playAnimation) {
        Animatable((if (playAnimation) value * 0.9 else value).toFloat())
    }
    LaunchedEffect(animationKey, value, playAnimation) {
        if (playAnimation) {
            animated.snapTo((value * 0.9).toFloat())
            animated.animateTo(
                targetValue = value.toFloat(),
                animationSpec = tween(900, delayMillis = 100, easing = FastOutSlowInEasing),
            )
        } else {
            animated.snapTo(value.toFloat())
        }
    }
    Text(
        text = formatCurrency(animated.value.toDouble(), visible = amountsVisible),
        color = Color.White,
        fontSize = 36.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.8).sp,
        modifier = modifier,
    )
}

@Composable
fun OverviewMetricRow(
    stockMarketValue: Double,
    cash: Double,
    positionCount: Int,
    amountsVisible: Boolean,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OverviewMetricCard(
            iconRes = R.drawable.ic_monitoring_rounded,
            label = "股票市值",
            value = formatCurrency(stockMarketValue, visible = amountsVisible),
            note = "$positionCount 只持仓",
            iconColor = Indigo,
            iconBackground = Indigo.copy(alpha = 0.11f),
            modifier = Modifier.weight(1f),
        )
        OverviewMetricCard(
            iconRes = R.drawable.ic_savings_rounded,
            label = "可用现金",
            value = formatCurrency(cash, visible = amountsVisible),
            note = "流动资金",
            iconColor = Gold,
            iconBackground = Gold.copy(alpha = 0.14f),
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun OverviewMetricCard(
    @DrawableRes iconRes: Int,
    label: String,
    value: String,
    note: String,
    iconColor: Color,
    iconBackground: Color,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = SurfaceColor,
        shape = RoundedCornerShape(20.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Column(Modifier.padding(16.dp)) {
            Box(
                modifier = Modifier.size(36.dp).background(iconBackground, RoundedCornerShape(11.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(iconRes),
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(19.dp),
                )
            }
            Text(
                text = label,
                color = Muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 14.dp),
            )
            Text(
                text = value,
                color = Ink,
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 5.dp),
            )
            Text(text = note, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
fun PositionMeterCard(
    positionRate: Double?,
    cash: Double,
    totalAsset: Double,
    animationKey: String,
    playAnimation: Boolean,
) {
    val target = (positionRate ?: 0.0).toFloat().coerceIn(0f, 1f)
    val animatedProgress = remember(animationKey, playAnimation) {
        Animatable(if (playAnimation) 0f else target)
    }
    LaunchedEffect(animationKey, target, playAnimation) {
        if (playAnimation) {
            animatedProgress.snapTo(0f)
            animatedProgress.animateTo(
                targetValue = target,
                animationSpec = tween(950, delayMillis = 220, easing = FastOutSlowInEasing),
            )
        } else {
            animatedProgress.snapTo(target)
        }
    }
    val cashRate = if (totalAsset == 0.0) 0.0 else cash / totalAsset

    Surface(
        color = SurfaceColor,
        shape = RoundedCornerShape(20.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(17.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Column {
                    Text("股票仓位", color = Muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = "按净资产计算",
                        color = MutedDark,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Text(
                    text = formatPercent(animatedProgress.value.toDouble()),
                    color = Ink,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 15.dp)
                    .height(9.dp)
                    .clip(CircleShape)
                    .background(Canvas),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(animatedProgress.value)
                        .height(9.dp)
                        .clip(CircleShape)
                        .background(Brush.horizontalGradient(listOf(Accent, Color(0xFF70D4B8)))),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 9.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("0%", color = Muted, fontSize = 10.sp)
                Text("现金占比 ${formatPercent(cashRate)}", color = Muted, fontSize = 10.sp)
            }
        }
    }
}

@Composable
fun IndustryAllocationCard(
    allocations: List<IndustryAllocation>,
    animationKey: String,
    playAnimation: Boolean,
) {
    val slices = remember(allocations) { allocations.toSlices() }

    OverviewSectionCard {
        OverviewSectionHeader(
            iconRes = R.drawable.ic_pie_chart_rounded,
            title = "行业分布",
            subtitle = "按总资产占比",
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DonutChart(
                slices = slices,
                animationKey = animationKey,
                playAnimation = playAnimation,
                industryCount = allocations.size,
                modifier = Modifier.size(132.dp),
            )
            Spacer(Modifier.width(20.dp))
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(13.dp),
            ) {
                slices.forEach { slice -> AllocationLegendRow(slice) }
            }
        }
    }
}

@Composable
private fun DonutChart(
    slices: List<AllocationSlice>,
    animationKey: String,
    playAnimation: Boolean,
    industryCount: Int,
    modifier: Modifier = Modifier,
) {
    val progress = remember(animationKey, playAnimation) {
        Animatable(if (playAnimation) 0f else 1f)
    }
    LaunchedEffect(animationKey, slices, playAnimation) {
        if (playAnimation) {
            progress.snapTo(0f)
            progress.animateTo(1f, tween(900, delayMillis = 180, easing = FastOutSlowInEasing))
        } else {
            progress.snapTo(1f)
        }
    }
    val total = slices.sumOf { it.weight }.takeIf { it > 0.0 } ?: 1.0

    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val strokeWidth = 15.dp.toPx()
            drawArc(
                color = Canvas,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(strokeWidth, cap = StrokeCap.Round),
            )
            var startAngle = -90f
            var remaining = 360f * progress.value
            slices.forEach { slice ->
                val fullSweep = (slice.weight / total * 360.0).toFloat()
                val visibleSweep = min(fullSweep, remaining.coerceAtLeast(0f))
                if (visibleSweep > 1f) {
                    val gap = min(3f, visibleSweep * 0.2f)
                    drawArc(
                        color = slice.color,
                        startAngle = startAngle + gap / 2f,
                        sweepAngle = (visibleSweep - gap).coerceAtLeast(0f),
                        useCenter = false,
                        style = Stroke(strokeWidth, cap = StrokeCap.Round),
                    )
                }
                remaining -= fullSweep
                startAngle += fullSweep
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = industryCount.toString(),
                color = Ink,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text("行业", color = Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun AllocationLegendRow(slice: AllocationSlice) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(slice.color, CircleShape))
        Text(
            text = slice.name,
            color = MutedDark,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).padding(start = 8.dp),
        )
        Text(
            text = formatPercent(slice.weight),
            color = Ink,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun TopHoldingsCard(
    positions: List<PositionSnapshot>,
    animationKey: String,
    playAnimation: Boolean,
    amountsVisible: Boolean,
) {
    OverviewSectionCard {
        OverviewSectionHeader(
            iconRes = R.drawable.ic_monitoring_rounded,
            title = "个股集中度",
            subtitle = "前五大持仓",
        )
        Column(
            modifier = Modifier.padding(top = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            positions.take(5).forEachIndexed { index, position ->
                HoldingConcentrationRow(
                    rank = index + 1,
                    position = position,
                    animationKey = "$animationKey-${position.symbol}",
                    delayMillis = index * 70,
                    playAnimation = playAnimation,
                    amountsVisible = amountsVisible,
                )
            }
        }
    }
}

@Composable
private fun HoldingConcentrationRow(
    rank: Int,
    position: PositionSnapshot,
    animationKey: String,
    delayMillis: Int,
    playAnimation: Boolean,
    amountsVisible: Boolean,
) {
    val target = (position.portfolioWeight ?: 0.0).toFloat().coerceIn(0f, 1f)
    val progress = remember(animationKey, playAnimation) {
        Animatable(if (playAnimation) 0f else target)
    }
    LaunchedEffect(animationKey, target, playAnimation) {
        if (playAnimation) {
            progress.snapTo(0f)
            progress.animateTo(
                target,
                tween(800, delayMillis = 220 + delayMillis, easing = FastOutSlowInEasing),
            )
        } else {
            progress.snapTo(target)
        }
    }

    Column(Modifier.padding(vertical = 11.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(28.dp).background(Canvas, RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = rank.toString().padStart(2, '0'),
                    color = MutedDark,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
            Column(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                Text(
                    text = position.name,
                    color = Ink,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(position.symbol, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatPercent(position.portfolioWeight),
                    color = Ink,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = formatCurrency(position.marketValue, visible = amountsVisible),
                    color = Muted,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 38.dp, top = 9.dp)
                .height(6.dp)
                .clip(CircleShape)
                .background(Canvas),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(progress.value)
                    .height(6.dp)
                    .clip(CircleShape)
                    .background(Accent),
            )
        }
    }
}

@Composable
private fun OverviewSectionCard(content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = SurfaceColor,
        shape = OverviewCardShape,
        border = androidx.compose.foundation.BorderStroke(1.dp, Border),
    ) {
        Column(Modifier.padding(19.dp), content = { content() })
    }
}

@Composable
private fun OverviewSectionHeader(
    @DrawableRes iconRes: Int,
    title: String,
    subtitle: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier.size(38.dp).background(AccentSoft, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                painter = painterResource(iconRes),
                contentDescription = null,
                tint = Accent,
                modifier = Modifier.size(20.dp),
            )
        }
        Column(Modifier.padding(start = 11.dp)) {
            Text(title, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            Text(subtitle, color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
fun OverviewDisclaimer() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.55f), RoundedCornerShape(16.dp))
            .padding(13.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            painter = painterResource(R.drawable.ic_info_rounded),
            contentDescription = null,
            tint = Muted,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = "本页展示快照事实；所有分析均需引用数据时间与证据，不直接生成交易指令。",
            color = Muted,
            fontSize = 10.sp,
            lineHeight = 16.sp,
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

private data class AllocationSlice(
    val name: String,
    val weight: Double,
    val color: Color,
)

private fun List<IndustryAllocation>.toSlices(): List<AllocationSlice> {
    return sortedByDescending { it.weight }.map {
        AllocationSlice(it.name, it.weight, parseColor(it.color))
    }
}

private fun parseColor(value: String): Color = runCatching {
    Color(android.graphics.Color.parseColor(value))
}.getOrDefault(Accent)
