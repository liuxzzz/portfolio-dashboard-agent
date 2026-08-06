package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.R
import com.horizon.portfolio.ui.AuthUiState

private val LoginNavy = Color(0xFF0E1A30)
private val LoginNavyLight = Color(0xFF20385A)
private val LoginOrange = Color(0xFFFF9D4D)
private val LoginOrangeSoft = Color(0xFFFFE8D3)
private val LoginMint = Color(0xFF70D2B6)
private val LoginField = Color(0xFFF5F7FA)
private val LoginMuted = Color(0xFF748198)

@Composable
fun LoginScreen(
    state: AuthUiState,
    onPhoneChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onRequestCode: () -> Unit,
    onLogin: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.linearGradient(
                    colors = listOf(LoginNavy, Color(0xFF172A48), LoginNavyLight),
                    start = Offset.Zero,
                    end = Offset.Infinite,
                ),
            ),
    ) {
        LoginBackdrop()
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 24.dp),
        ) {
            LoginBrand()
            Spacer(Modifier.height(28.dp))
            Text(
                text = "看懂持仓，\n心里更有数",
                color = Color.White,
                fontSize = 36.sp,
                lineHeight = 44.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "登录你的私人组合空间，持仓、标签和洞察只属于你。",
                color = Color.White.copy(alpha = 0.68f),
                style = MaterialTheme.typography.bodyMedium,
                lineHeight = 22.sp,
                modifier = Modifier.padding(top = 12.dp, end = 30.dp),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 18.dp, bottom = 28.dp),
            ) {
                TrustPill("加密会话")
                TrustPill("数据隔离")
            }
            LoginCard(
                state = state,
                onPhoneChange = onPhoneChange,
                onCodeChange = onCodeChange,
                onRequestCode = onRequestCode,
                onLogin = onLogin,
            )
            Text(
                text = "验证成功即代表你同意安全地创建个人账户",
                color = Color.White.copy(alpha = 0.52f),
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp, bottom = 12.dp),
            )
        }
    }
}

@Composable
private fun LoginBrand() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Surface(
            modifier = Modifier.size(72.dp),
            shape = RoundedCornerShape(23.dp),
            color = LoginOrange,
            shadowElevation = 14.dp,
        ) {
            Image(
                painter = painterResource(R.mipmap.ic_launcher_foreground),
                contentDescription = "猫猫有数 Logo",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "猫猫有数",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "PORTFOLIO COMPANION",
                color = LoginOrange,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
            )
        }
    }
}

@Composable
private fun TrustPill(label: String) {
    Surface(
        shape = RoundedCornerShape(50),
        color = Color.White.copy(alpha = 0.09f),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Color.White.copy(alpha = 0.10f),
        ),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .background(LoginMint, CircleShape),
            )
            Text(
                text = label,
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun LoginCard(
    state: AuthUiState,
    onPhoneChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onRequestCode: () -> Unit,
    onLogin: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(30.dp),
        color = Color.White.copy(alpha = 0.97f),
        shadowElevation = 22.dp,
    ) {
        Column(modifier = Modifier.padding(22.dp)) {
            Text(
                text = "手机号登录",
                color = LoginNavy,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
            )
            Text(
                text = "未注册手机号验证后将自动创建账户",
                color = LoginMuted,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(top = 5.dp, bottom = 20.dp),
            )
            OutlinedTextField(
                value = state.phone,
                onValueChange = onPhoneChange,
                label = { Text("手机号") },
                prefix = {
                    Text(
                        text = "+86  ",
                        color = LoginNavy,
                        fontWeight = FontWeight.Bold,
                    )
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                enabled = !state.isLoggingIn,
                shape = RoundedCornerShape(17.dp),
                colors = loginFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(13.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = state.code,
                    onValueChange = onCodeChange,
                    label = { Text("6 位验证码") },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.NumberPassword,
                    ),
                    singleLine = true,
                    enabled = !state.isLoggingIn,
                    shape = RoundedCornerShape(17.dp),
                    colors = loginFieldColors(),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(9.dp))
                Button(
                    onClick = onRequestCode,
                    enabled = !state.isSendingCode && state.resendSeconds == 0,
                    shape = RoundedCornerShape(17.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = LoginOrangeSoft,
                        contentColor = LoginNavy,
                        disabledContainerColor = LoginField,
                        disabledContentColor = LoginMuted,
                    ),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        horizontal = 13.dp,
                    ),
                    modifier = Modifier.height(56.dp),
                ) {
                    Text(
                        text = when {
                            state.isSendingCode -> "发送中"
                            state.resendSeconds > 0 -> "${state.resendSeconds}s"
                            state.codeRequested -> "重新发送"
                            else -> "获取验证码"
                        },
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            state.message?.let { message ->
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = LoginMuted,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            Button(
                onClick = onLogin,
                enabled = !state.isLoggingIn &&
                    state.phone.length == 11 &&
                    state.code.length == 6,
                shape = RoundedCornerShape(18.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = LoginOrange,
                    contentColor = LoginNavy,
                    disabledContainerColor = Color(0xFFE6E9ED),
                    disabledContentColor = Color(0xFFADB5C2),
                ),
                elevation = ButtonDefaults.buttonElevation(
                    defaultElevation = 0.dp,
                    pressedElevation = 0.dp,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 20.dp)
                    .height(56.dp),
            ) {
                Text(
                    text = if (state.isLoggingIn) "正在进入…" else "安全登录",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 14.dp),
            ) {
                Box(
                    Modifier
                        .size(7.dp)
                        .background(LoginMint, CircleShape),
                )
                Text(
                    text = "  登录令牌由系统安全加密保存",
                    color = LoginMuted,
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun loginFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = LoginField,
    unfocusedContainerColor = LoginField,
    disabledContainerColor = LoginField.copy(alpha = 0.72f),
    focusedBorderColor = LoginOrange,
    unfocusedBorderColor = Color.Transparent,
    disabledBorderColor = Color.Transparent,
    focusedLabelColor = LoginNavy,
    unfocusedLabelColor = LoginMuted,
    cursorColor = LoginOrange,
)

@Composable
private fun LoginBackdrop() {
    Canvas(modifier = Modifier.fillMaxSize()) {
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(LoginOrange.copy(alpha = 0.25f), Color.Transparent),
                center = Offset(size.width * 0.95f, size.height * 0.08f),
                radius = size.width * 0.68f,
            ),
            radius = size.width * 0.68f,
            center = Offset(size.width * 0.95f, size.height * 0.08f),
        )
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(LoginMint.copy(alpha = 0.12f), Color.Transparent),
                center = Offset(size.width * 0.10f, size.height * 0.78f),
                radius = size.width * 0.78f,
            ),
            radius = size.width * 0.78f,
            center = Offset(size.width * 0.10f, size.height * 0.78f),
        )

        val gridColor = Color.White.copy(alpha = 0.035f)
        val gridStep = size.width / 6f
        var x = 0f
        while (x <= size.width) {
            drawLine(gridColor, Offset(x, 0f), Offset(x, size.height), 1f)
            x += gridStep
        }
        var y = size.height * 0.12f
        while (y <= size.height) {
            drawLine(gridColor, Offset(0f, y), Offset(size.width, y), 1f)
            y += gridStep
        }

        val chartPath = Path().apply {
            moveTo(-size.width * 0.06f, size.height * 0.42f)
            cubicTo(
                size.width * 0.18f,
                size.height * 0.38f,
                size.width * 0.26f,
                size.height * 0.47f,
                size.width * 0.43f,
                size.height * 0.39f,
            )
            cubicTo(
                size.width * 0.58f,
                size.height * 0.31f,
                size.width * 0.70f,
                size.height * 0.37f,
                size.width * 1.06f,
                size.height * 0.25f,
            )
        }
        drawPath(
            path = chartPath,
            color = LoginMint.copy(alpha = 0.22f),
            style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
        )
        drawCircle(
            color = LoginOrange.copy(alpha = 0.80f),
            radius = 5.dp.toPx(),
            center = Offset(size.width * 0.43f, size.height * 0.39f),
        )
        drawCircle(
            color = Color.White.copy(alpha = 0.92f),
            radius = 2.dp.toPx(),
            center = Offset(size.width * 0.43f, size.height * 0.39f),
        )
    }
}
