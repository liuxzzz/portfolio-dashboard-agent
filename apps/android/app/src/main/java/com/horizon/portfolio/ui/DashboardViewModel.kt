package com.horizon.portfolio.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.horizon.portfolio.data.repository.DashboardSource
import com.horizon.portfolio.data.repository.PortfolioRepository
import com.horizon.portfolio.domain.model.DashboardPayload
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = true,
    val isRunningAgent: Boolean = false,
    val savingIndustrySymbol: String? = null,
    val dashboard: DashboardPayload? = null,
    val source: DashboardSource? = null,
    val message: String? = null,
)

class DashboardViewModel(
    private val repository: PortfolioRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = mutableState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoading = true, message = null) }
            try {
                val result = repository.loadDashboard()
                mutableState.update {
                    it.copy(
                        isLoading = false,
                        dashboard = result.payload,
                        source = result.source,
                        message = result.warning,
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isLoading = false,
                        message = error.message ?: "加载组合失败",
                    )
                }
            }
        }
    }

    fun runAgent() {
        if (mutableState.value.isRunningAgent) return

        viewModelScope.launch {
            mutableState.update { it.copy(isRunningAgent = true, message = null) }
            try {
                repository.runAgent()
                val result = repository.loadDashboard()
                mutableState.update {
                    it.copy(
                        isRunningAgent = false,
                        dashboard = result.payload,
                        source = result.source,
                        message = "组合观察已更新。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isRunningAgent = false,
                        message = error.message ?: "Agent 运行失败",
                    )
                }
            }
        }
    }

    fun setMainIndustry(
        market: String,
        symbol: String,
        mainIndustryId: String,
        mainIndustryName: String,
    ) {
        if (mutableState.value.savingIndustrySymbol != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(savingIndustrySymbol = symbol, message = null) }
            try {
                val result = repository.setMainIndustry(market, symbol, mainIndustryId)
                mutableState.update {
                    it.copy(
                        dashboard = result.payload,
                        source = result.source,
                        savingIndustrySymbol = null,
                        message = "已按你的认知归类为$mainIndustryName。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        savingIndustrySymbol = null,
                        message = error.message ?: "主行业保存失败",
                    )
                }
            }
        }
    }

    fun restoreAutomaticIndustry(market: String, symbol: String) {
        if (mutableState.value.savingIndustrySymbol != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(savingIndustrySymbol = symbol, message = null) }
            try {
                val result = repository.restoreAutomaticIndustry(market, symbol)
                mutableState.update {
                    it.copy(
                        dashboard = result.payload,
                        source = result.source,
                        savingIndustrySymbol = null,
                        message = "已恢复数据源自动分类。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        savingIndustrySymbol = null,
                        message = error.message ?: "恢复自动分类失败",
                    )
                }
            }
        }
    }

    companion object {
        fun factory(repository: PortfolioRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    require(modelClass.isAssignableFrom(DashboardViewModel::class.java))
                    return DashboardViewModel(repository) as T
                }
            }
    }
}
