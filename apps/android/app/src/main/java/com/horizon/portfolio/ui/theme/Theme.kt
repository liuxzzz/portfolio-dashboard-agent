package com.horizon.portfolio.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Canvas = Color(0xFFF3F5F7)
val Surface = Color(0xFFFFFFFF)
val Ink = Color(0xFF172033)
val MutedDark = Color(0xFF526078)
val Muted = Color(0xFF7B8799)
val Border = Color(0xFFDFE5EC)
val Accent = Color(0xFF5BC5A7)
val AccentSoft = Color(0xFFE8F7F2)
val Positive = Color(0xFF12815B)
val Negative = Color(0xFFD75454)
val NegativeSoft = Color(0xFFFCECEC)
val Warning = Color(0xFFA56A00)
val WarningSoft = Color(0xFFFFF2D8)
val Info = Color(0xFF3E6FCA)
val InfoSoft = Color(0xFFE9F0FF)

private val colors = lightColorScheme(
    primary = Ink,
    onPrimary = Surface,
    secondary = Accent,
    onSecondary = Ink,
    background = Canvas,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    surfaceVariant = AccentSoft,
    onSurfaceVariant = MutedDark,
    error = Negative,
    outline = Border,
)

@Composable
fun PortfolioTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        content = content,
    )
}
