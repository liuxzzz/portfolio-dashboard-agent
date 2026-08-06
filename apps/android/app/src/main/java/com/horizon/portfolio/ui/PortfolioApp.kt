package com.horizon.portfolio.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import com.horizon.portfolio.ui.components.PortfolioSplashScreen
import com.horizon.portfolio.ui.screens.AgentScreen
import com.horizon.portfolio.ui.screens.HoldingsScreen
import com.horizon.portfolio.ui.screens.LoginScreen
import com.horizon.portfolio.ui.screens.OverviewScreen
import com.horizon.portfolio.ui.screens.PositionDetailScreen
import com.horizon.portfolio.ui.screens.ProfileScreen
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
    TopLevelDestination("profile", "我的", R.drawable.ic_info_rounded),
)

@Composable
fun PortfolioApp() {
    val application = LocalContext.current.applicationContext as PortfolioApplication
    val authViewModel: AuthViewModel = viewModel(
        factory = AuthViewModel.factory(application.container.authRepository),
    )
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val session by application.container.authSessionStore.session.collectAsStateWithLifecycle()
    var splashVisible by rememberSaveable { mutableStateOf(true) }

    Box(modifier = Modifier.fillMaxSize()) {
        val activeSession = session
        if (activeSession == null) {
            LoginScreen(
                state = authState,
                onPhoneChange = authViewModel::updatePhone,
                onCodeChange = authViewModel::updateCode,
                onRequestCode = authViewModel::requestCode,
                onLogin = authViewModel::login,
            )
        } else {
            key(activeSession.instanceId) {
                AuthenticatedPortfolioApp(
                    sessionKey = activeSession.instanceId,
                    maskedPhone = activeSession.user.phone,
                    authState = authState,
                    authViewModel = authViewModel,
                )
            }
        }
        AnimatedVisibility(
            visible = splashVisible,
            enter = EnterTransition.None,
            exit = fadeOut(animationSpec = tween(180)),
            modifier = Modifier.fillMaxSize(),
        ) {
            PortfolioSplashScreen(
                onAnimationFinished = { splashVisible = false },
            )
        }
    }
}

@Composable
private fun AuthenticatedPortfolioApp(
    sessionKey: String,
    maskedPhone: String,
    authState: AuthUiState,
    authViewModel: AuthViewModel,
) {
    val application = LocalContext.current.applicationContext as PortfolioApplication
    val viewModel: DashboardViewModel = viewModel(
        key = "dashboard-$sessionKey",
        factory = DashboardViewModel.factory(application.container.portfolioRepository),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    var amountsVisible by rememberSaveable { mutableStateOf(false) }
    PortfolioContent(
        state = state,
        viewModel = viewModel,
        amountsVisible = amountsVisible,
        maskedPhone = maskedPhone,
        isLoggingOut = authState.isLoggingOut,
        onLogout = authViewModel::logout,
        onToggleAmountsVisibility = { amountsVisible = !amountsVisible },
    )
}

@Composable
private fun PortfolioContent(
    state: DashboardUiState,
    viewModel: DashboardViewModel,
    amountsVisible: Boolean,
    maskedPhone: String,
    isLoggingOut: Boolean,
    onLogout: () -> Unit,
    onToggleAmountsVisibility: () -> Unit,
) {
    val dashboard = state.dashboard
    if (dashboard == null) {
        if (state.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            ProfileScreen(
                maskedPhone = maskedPhone,
                industryTags = state.industryTags,
                isCreatingTag = state.isCreatingTag,
                deletingTagId = state.deletingTagId,
                message = state.message,
                isLoggingOut = isLoggingOut,
                showDashboardRetry = true,
                onCreateTag = viewModel::createIndustryTag,
                onDeleteTag = viewModel::deleteIndustryTag,
                onRefreshDashboard = viewModel::refresh,
                onLogout = onLogout,
            )
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
                OverviewScreen(
                    state = state,
                    amountsVisible = amountsVisible,
                    onToggleAmountsVisibility = onToggleAmountsVisibility,
                    onRefresh = viewModel::refresh,
                )
            }
            composable("holdings") {
                HoldingsScreen(
                    snapshot = dashboard.snapshot,
                    amountsVisible = amountsVisible,
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
            composable("profile") {
                ProfileScreen(
                    maskedPhone = maskedPhone,
                    industryTags = state.industryTags,
                    isCreatingTag = state.isCreatingTag,
                    deletingTagId = state.deletingTagId,
                    message = state.message,
                    isLoggingOut = isLoggingOut,
                    onCreateTag = viewModel::createIndustryTag,
                    onDeleteTag = viewModel::deleteIndustryTag,
                    onRefreshDashboard = viewModel::refresh,
                    onLogout = onLogout,
                )
            }
            composable("position/{symbol}") { entry ->
                PositionDetailScreen(
                    snapshot = dashboard.snapshot,
                    symbol = entry.arguments?.getString("symbol").orEmpty(),
                    amountsVisible = amountsVisible,
                    industryTags = state.industryTags,
                    isSavingTag = state.savingTagSymbol == entry.arguments?.getString("symbol"),
                    message = state.message,
                    onSetIndustryTag = viewModel::setIndustryTag,
                    onRestoreAutomaticIndustry = viewModel::restoreAutomaticIndustry,
                    onBack = navController::popBackStack,
                )
            }
        }
    }
}
