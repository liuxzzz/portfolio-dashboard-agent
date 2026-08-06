package com.horizon.portfolio.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.horizon.portfolio.data.auth.AuthRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val phone: String = "",
    val code: String = "",
    val codeRequested: Boolean = false,
    val resendSeconds: Int = 0,
    val isSendingCode: Boolean = false,
    val isLoggingIn: Boolean = false,
    val isLoggingOut: Boolean = false,
    val message: String? = null,
)

class AuthViewModel(
    private val repository: AuthRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = mutableState.asStateFlow()
    private var countdownJob: Job? = null

    fun updatePhone(value: String) {
        mutableState.update {
            it.copy(phone = value.filter(Char::isDigit).take(11), message = null)
        }
    }

    fun updateCode(value: String) {
        mutableState.update {
            it.copy(code = value.filter(Char::isDigit).take(6), message = null)
        }
    }

    fun requestCode() {
        val phone = mutableState.value.phone
        if (!phone.matches(Regex("^1[3-9]\\d{9}$"))) {
            mutableState.update { it.copy(message = "请输入正确的中国大陆手机号。") }
            return
        }
        if (mutableState.value.isSendingCode || mutableState.value.resendSeconds > 0) return
        viewModelScope.launch {
            mutableState.update { it.copy(isSendingCode = true, message = null) }
            try {
                val retryAfter = repository.requestCode(phone)
                mutableState.update {
                    it.copy(
                        codeRequested = true,
                        isSendingCode = false,
                        resendSeconds = retryAfter,
                        message = "验证码已发送，请留意短信。",
                    )
                }
                startCountdown()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isSendingCode = false,
                        message = error.message ?: "验证码发送失败。",
                    )
                }
            }
        }
    }

    fun login() {
        val current = mutableState.value
        if (current.code.length != 6) {
            mutableState.update { it.copy(message = "请输入 6 位验证码。") }
            return
        }
        if (current.isLoggingIn) return
        viewModelScope.launch {
            mutableState.update { it.copy(isLoggingIn = true, message = null) }
            try {
                repository.login(current.phone, current.code)
                mutableState.value = AuthUiState()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isLoggingIn = false,
                        message = error.message ?: "登录失败。",
                    )
                }
            }
        }
    }

    fun logout() {
        if (mutableState.value.isLoggingOut) return
        viewModelScope.launch {
            mutableState.update { it.copy(isLoggingOut = true, message = null) }
            repository.logout()
            mutableState.value = AuthUiState()
        }
    }

    private fun startCountdown() {
        countdownJob?.cancel()
        countdownJob = viewModelScope.launch {
            while (mutableState.value.resendSeconds > 0) {
                delay(1_000)
                mutableState.update {
                    it.copy(resendSeconds = (it.resendSeconds - 1).coerceAtLeast(0))
                }
            }
        }
    }

    companion object {
        fun factory(repository: AuthRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    require(modelClass.isAssignableFrom(AuthViewModel::class.java))
                    return AuthViewModel(repository) as T
                }
            }
    }
}
