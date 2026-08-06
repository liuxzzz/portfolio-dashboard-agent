package com.horizon.portfolio.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.horizon.portfolio.data.repository.DashboardSource
import com.horizon.portfolio.data.repository.PortfolioRepository
import com.horizon.portfolio.domain.model.DashboardPayload
import com.horizon.portfolio.domain.model.IndustryTag
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val isLoading: Boolean = true,
    val isRunningAgent: Boolean = false,
    val savingTagSymbol: String? = null,
    val isCreatingTag: Boolean = false,
    val deletingTagId: String? = null,
    val dashboard: DashboardPayload? = null,
    val industryTags: List<IndustryTag> = emptyList(),
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
            val loadedTags = try {
                repository.loadIndustryTags()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                null
            }
            try {
                val result = repository.loadDashboard()
                mutableState.update {
                    it.copy(
                        isLoading = false,
                        dashboard = result.payload,
                        industryTags = loadedTags ?: result.payload.industryTags,
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
                        industryTags = loadedTags ?: it.industryTags,
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

    fun createIndustryTag(name: String, color: String) {
        if (mutableState.value.isCreatingTag) return
        viewModelScope.launch {
            mutableState.update { it.copy(isCreatingTag = true, message = null) }
            try {
                val createdTag = repository.createIndustryTag(name, color)
                mutableState.update {
                    it.copy(
                        industryTags = (it.industryTags + createdTag)
                            .sortedBy(IndustryTag::sortOrder),
                        isCreatingTag = false,
                        message = "已新增行业标签“$name”。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isCreatingTag = false,
                        message = error.message ?: "行业标签新增失败",
                    )
                }
            }
        }
    }

    fun deleteIndustryTag(tagId: String, tagName: String) {
        if (mutableState.value.deletingTagId != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(deletingTagId = tagId, message = null) }
            try {
                repository.deleteIndustryTag(tagId)
                mutableState.update {
                    it.copy(industryTags = it.industryTags.filterNot { tag -> tag.id == tagId })
                }
                val dashboardResult = if (mutableState.value.dashboard != null) {
                    try {
                        repository.loadDashboard()
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        null
                    }
                } else {
                    null
                }
                mutableState.update {
                    it.copy(
                        dashboard = dashboardResult?.payload ?: it.dashboard,
                        industryTags = dashboardResult?.payload?.industryTags
                            ?: it.industryTags,
                        source = dashboardResult?.source ?: it.source,
                        deletingTagId = null,
                        message = if (dashboardResult == null && it.dashboard != null) {
                            "标签“$tagName”已删除；请重新加载组合以刷新自动分类。"
                        } else {
                            "已删除行业标签“$tagName”，相关股票已恢复自动分类。"
                        },
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        deletingTagId = null,
                        message = error.message ?: "行业标签删除失败",
                    )
                }
            }
        }
    }

    fun setIndustryTag(
        market: String,
        symbol: String,
        tagId: String,
        tagName: String,
    ) {
        if (mutableState.value.savingTagSymbol != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(savingTagSymbol = symbol, message = null) }
            try {
                val result = repository.setIndustryTag(market, symbol, tagId)
                mutableState.update {
                    it.copy(
                        dashboard = result.payload,
                        industryTags = result.payload.industryTags,
                        source = result.source,
                        savingTagSymbol = null,
                        message = "已为该股票选择标签“$tagName”。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        savingTagSymbol = null,
                        message = error.message ?: "行业标签保存失败",
                    )
                }
            }
        }
    }

    fun restoreAutomaticIndustry(market: String, symbol: String) {
        if (mutableState.value.savingTagSymbol != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(savingTagSymbol = symbol, message = null) }
            try {
                val result = repository.restoreAutomaticIndustry(market, symbol)
                mutableState.update {
                    it.copy(
                        dashboard = result.payload,
                        industryTags = result.payload.industryTags,
                        source = result.source,
                        savingTagSymbol = null,
                        message = "已恢复数据源自动分类。",
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        savingTagSymbol = null,
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
