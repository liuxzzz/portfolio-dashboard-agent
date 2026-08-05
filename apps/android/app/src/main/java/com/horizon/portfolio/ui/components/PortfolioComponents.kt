package com.horizon.portfolio.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.ui.theme.Accent
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Border
import com.horizon.portfolio.ui.theme.Canvas as CanvasColor
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.MutedDark
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun PageHeader(
    eyebrow: String,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        Text(
            text = eyebrow,
            color = Muted,
            fontSize = 11.sp,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.5.sp,
        )
        Text(
            text = title,
            color = Ink,
            fontSize = 34.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(top = 6.dp),
        )
        Text(
            text = subtitle,
            color = Muted,
            fontSize = 14.sp,
            lineHeight = 21.sp,
            modifier = Modifier.padding(top = 5.dp),
        )
    }
}

@Composable
fun MetricCard(
    label: String,
    value: String,
    note: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = CardDefaults.outlinedCardBorder(),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(label, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(
                value,
                color = Ink,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(note, color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
fun SectionCard(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = CardDefaults.outlinedCardBorder(),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(18.dp)) {
            Text(title, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
            Text(subtitle, color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Spacer(Modifier.height(18.dp))
            content()
        }
    }
}

@Composable
fun AllocationBar(
    label: String,
    value: Double,
    color: Color = Accent,
) {
    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, color = MutedDark, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Text(formatPercent(value), color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        LinearProgressIndicator(
            progress = { value.toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth().height(7.dp),
            color = color,
            trackColor = CanvasColor,
            strokeCap = StrokeCap.Round,
        )
    }
}

@Composable
fun SourceBadge(label: String) {
    Text(
        text = label,
        color = Ink,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier
            .background(AccentSoft, RoundedCornerShape(99.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
    )
}

@Composable
fun Sparkline(values: List<Double>, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxWidth().height(72.dp)) {
        if (values.size < 2) return@Canvas
        val min = values.min()
        val max = values.max()
        val range = (max - min).takeIf { it > 0 } ?: 1.0
        val stepX = size.width / (values.size - 1)
        val path = Path()
        values.forEachIndexed { index, value ->
            val point = Offset(
                x = index * stepX,
                y = size.height - (((value - min) / range) * size.height).toFloat(),
            )
            if (index == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
        }
        drawPath(path, color = Accent, style = Stroke(width = 4.dp.toPx(), cap = StrokeCap.Round))
    }
}

fun formatCurrency(
    value: Double?,
    showSign: Boolean = false,
    visible: Boolean = true,
): String {
    if (!visible) return "••••••"
    if (value == null || value.isNaN()) return "—"
    val sign = if (showSign && value > 0) "+" else ""
    val formatter = NumberFormat.getNumberInstance(Locale.SIMPLIFIED_CHINESE).apply {
        maximumFractionDigits = 0
    }
    return "$sign¥${formatter.format(value)}"
}

fun formatPercent(value: Double?, showSign: Boolean = false): String {
    if (value == null || value.isNaN()) return "—"
    val sign = if (showSign && value > 0) "+" else ""
    return "$sign${String.format(Locale.SIMPLIFIED_CHINESE, "%.2f", value * 100)}%"
}

fun formatTime(value: String?): String {
    if (value == null) return "未知"
    return runCatching {
        DateTimeFormatter.ofPattern("MM-dd HH:mm")
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(value))
    }.getOrDefault(value)
}
