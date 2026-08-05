package com.horizon.portfolio.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.horizon.portfolio.PortfolioApplication
import com.horizon.portfolio.R
import com.horizon.portfolio.ui.screens.AgentScreen
import com.horizon.portfolio.ui.screens.HoldingsScreen
import com.horizon.portfolio.ui.screens.OverviewScreen
import com.horizon.portfolio.ui.screens.PositionDetailScreen
import com.horizon.portfolio.ui.theme.Accent
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.Surface

private data class TopLevelDestination(
    val route: String,
    val label: String,
    val iconRes: Int,
)

private val topLevelDestinations = listOf(
    TopLevelDestination("overview", "概览", R.drawable.ic_overview_rounded),
    TopLevelDestination("holdings", "持仓", R.drawable.ic_holdings_rounded),
    TopLevelDestination("agent", "Agent", R.drawable.ic_agent_rounded),
)

@Composable
fun PortfolioApp() {
    val application = LocalContext.current.applicationContext as PortfolioApplication
    val viewModel: DashboardViewModel = viewModel(
        factory = DashboardViewModel.factory(application.container.portfolioRepository),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val dashboard = state.dashboard

    if (dashboard == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (state.isLoading) {
                CircularProgressIndicator()
            } else {
                androidx.compose.foundation.layout.Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(state.message ?: "加载组合失败")
                    Button(
                        onClick = viewModel::refresh,
                        modifier = Modifier.padding(top = 12.dp),
                    ) {
                        Text("重试")
                    }
                }
            }
        }
        return
    }

    val navController = rememberNavController()
    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Surface,
                tonalElevation = 0.dp,
            ) {
                val backStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = backStackEntry?.destination
                topLevelDestinations.forEach { destination ->
                    NavigationBarItem(
                        selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true,
                        onClick = {
                            navController.navigate(destination.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = {
                            Icon(
                                painter = painterResource(destination.iconRes),
                                contentDescription = destination.label,
                            )
                        },
                        label = { Text(destination.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Ink,
                            selectedTextColor = Accent,
                            indicatorColor = AccentSoft,
                            unselectedIconColor = Muted,
                            unselectedTextColor = Muted,
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "overview",
            modifier = Modifier.padding(innerPadding),
        ) {
            composable("overview") {
                OverviewScreen(state = state, onRefresh = viewModel::refresh)
            }
            composable("holdings") {
                HoldingsScreen(
                    snapshot = dashboard.snapshot,
                    onPositionClick = { symbol -> navController.navigate("position/$symbol") },
                )
            }
            composable("agent") {
                AgentScreen(
                    run = dashboard.latestAgentRun,
                    isRunning = state.isRunningAgent,
                    message = state.message,
                    onRunAgent = viewModel::runAgent,
                )
            }
            composable("position/{symbol}") { entry ->
                PositionDetailScreen(
                    snapshot = dashboard.snapshot,
                    symbol = entry.arguments?.getString("symbol").orEmpty(),
                    onBack = navController::popBackStack,
                )
            }
        }
    }
}
