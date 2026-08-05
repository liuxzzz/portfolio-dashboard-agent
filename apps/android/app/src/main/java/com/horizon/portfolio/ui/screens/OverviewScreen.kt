package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.horizon.portfolio.data.repository.DashboardSource
import com.horizon.portfolio.ui.DashboardUiState
import com.horizon.portfolio.ui.components.IndustryAllocationCard
import com.horizon.portfolio.ui.components.OverviewDisclaimer
import com.horizon.portfolio.ui.components.OverviewHeader
import com.horizon.portfolio.ui.components.OverviewMessageBanner
import com.horizon.portfolio.ui.components.OverviewMetricRow
import com.horizon.portfolio.ui.components.OverviewReveal
import com.horizon.portfolio.ui.components.PortfolioHeroCard
import com.horizon.portfolio.ui.components.PositionMeterCard
import com.horizon.portfolio.ui.components.TopHoldingsCard
import com.horizon.portfolio.ui.theme.Canvas
import kotlinx.coroutines.delay

@Composable
fun OverviewScreen(
    state: DashboardUiState,
    onRefresh: () -> Unit,
) {
    val dashboard = requireNotNull(state.dashboard)
    val snapshot = dashboard.snapshot
    val topPositions = snapshot.positions.sortedByDescending { it.marketValue }.take(5)
    var playIntroAnimation by rememberSaveable { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        delay(1_700)
        playIntroAnimation = false
    }

    val sourceLabel = when (state.source) {
        DashboardSource.REMOTE -> when (snapshot.freshness) {
            "fresh" -> "实时快照"
            "stale" -> "历史快照"
            else -> "本地导入"
        }
        DashboardSource.CACHE -> "本机缓存"
        DashboardSource.DEMO -> "演示数据"
        null -> "加载中"
    }

    LazyColumn(
        modifier = Modifier.background(Canvas),
        contentPadding = PaddingValues(start = 20.dp, top = 18.dp, end = 20.dp, bottom = 26.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item(key = "header") {
            OverviewHeader(
                accountName = snapshot.accountName,
                sourceLabel = sourceLabel,
                isLoading = state.isLoading,
                onRefresh = onRefresh,
            )
        }

        item(key = "message") {
            OverviewMessageBanner(
                message = state.message,
                isLoading = state.isLoading,
                onRefresh = onRefresh,
            )
        }

        item(key = "hero") {
            OverviewReveal(
                animationKey = snapshot.id,
                delayMillis = 40,
                playAnimation = playIntroAnimation,
            ) {
                PortfolioHeroCard(
                    totalAsset = snapshot.totalAsset,
                    dayProfit = snapshot.dayProfit,
                    dayProfitRate = snapshot.dayProfitRate,
                    history = dashboard.history,
                    sourceSyncedAt = snapshot.sourceSyncedAt,
                    animationKey = snapshot.id,
                    playAnimation = playIntroAnimation,
                )
            }
        }

        item(key = "metrics") {
            OverviewReveal(
                animationKey = snapshot.id,
                delayMillis = 120,
                playAnimation = playIntroAnimation,
            ) {
                OverviewMetricRow(
                    stockMarketValue = snapshot.stockMarketValue,
                    cash = snapshot.cash,
                    positionCount = snapshot.positions.size,
                )
            }
        }

        item(key = "position-meter") {
            OverviewReveal(
                animationKey = snapshot.id,
                delayMillis = 190,
                playAnimation = playIntroAnimation,
            ) {
                PositionMeterCard(
                    positionRate = snapshot.positionRate,
                    cash = snapshot.cash,
                    totalAsset = snapshot.totalAsset,
                    animationKey = snapshot.id,
                    playAnimation = playIntroAnimation,
                )
            }
        }

        item(key = "industries") {
            OverviewReveal(
                animationKey = snapshot.id,
                delayMillis = 260,
                playAnimation = playIntroAnimation,
            ) {
                IndustryAllocationCard(
                    allocations = dashboard.industries,
                    animationKey = snapshot.id,
                    playAnimation = playIntroAnimation,
                )
            }
        }

        item(key = "concentration") {
            OverviewReveal(
                animationKey = snapshot.id,
                delayMillis = 330,
                playAnimation = playIntroAnimation,
            ) {
                TopHoldingsCard(
                    positions = topPositions,
                    animationKey = snapshot.id,
                    playAnimation = playIntroAnimation,
                )
            }
        }

        item(key = "disclaimer") {
            OverviewDisclaimer()
        }
    }
}
