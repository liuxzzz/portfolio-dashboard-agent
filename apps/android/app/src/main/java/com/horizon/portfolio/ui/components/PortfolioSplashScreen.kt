package com.horizon.portfolio.ui.components

import androidx.activity.compose.LocalActivity
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.geometry.lerp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin

private val SplashBackground = Color(0xFF0E1A30)
private val SplashPanel = Color(0xFF13223B)
private val SplashGrid = Color.White.copy(alpha = 0.07f)
private val CatCream = Color(0xFFFFF8EC)
private val CatNavy = Color(0xFF1B2A44)
private val CatOrange = Color(0xFFFF984F)
private val RisingRed = Color(0xFFFF7B7B)
private val MotionMint = Color(0xFF5BC5A7)

private data class CatMotion(
    val groundPoint: Offset,
    val rotation: Float,
    val scaleX: Float,
    val scaleY: Float,
    val airborne: Boolean,
    val trailStrength: Float,
)

@Composable
fun PortfolioSplashScreen(
    onAnimationFinished: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val progress = remember { Animatable(0f) }
    val view = LocalView.current
    val activity = LocalActivity.current

    DisposableEffect(view, activity) {
        val controller = activity?.let { WindowCompat.getInsetsController(it.window, view) }
        val previousLightStatusBars = controller?.isAppearanceLightStatusBars
        val previousLightNavigationBars = controller?.isAppearanceLightNavigationBars
        controller?.isAppearanceLightStatusBars = false
        controller?.isAppearanceLightNavigationBars = false

        onDispose {
            if (previousLightStatusBars != null) {
                controller.isAppearanceLightStatusBars = previousLightStatusBars
            }
            if (previousLightNavigationBars != null) {
                controller.isAppearanceLightNavigationBars = previousLightNavigationBars
            }
        }
    }

    LaunchedEffect(Unit) {
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(durationMillis = 1_500, easing = LinearEasing),
        )
        onAnimationFinished()
    }

    val endingAlpha = when {
        progress.value < 0.94f -> 1f
        else -> 1f - ((progress.value - 0.94f) / 0.06f).coerceIn(0f, 1f) * 0.16f
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .alpha(endingAlpha)
            .background(SplashBackground),
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .semantics { contentDescription = "猫咪沿上涨曲线跳跃" },
        ) {
            drawSplash(progress.value)
        }
    }
}

private fun DrawScope.drawSplash(progress: Float) {
    val horizontalPadding = size.width * 0.10f
    val chartTop = size.height * 0.22f
    val chartBottom = size.height * 0.74f
    val panelRect = Rect(
        left = horizontalPadding * 0.55f,
        top = size.height * 0.10f,
        right = size.width - horizontalPadding * 0.55f,
        bottom = size.height * 0.84f,
    )

    drawRoundRect(
        color = SplashPanel,
        topLeft = panelRect.topLeft,
        size = panelRect.size,
        cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.width * 0.075f),
    )

    repeat(3) { index ->
        val y = chartTop + ((chartBottom - chartTop) * (index + 1) / 4f)
        drawLine(
            color = SplashGrid,
            start = Offset(horizontalPadding, y),
            end = Offset(size.width - horizontalPadding, y),
            strokeWidth = 1.5f,
        )
    }

    val nodes = listOf(
        Offset(size.width * 0.20f, size.height * 0.72f),
        Offset(size.width * 0.41f, size.height * 0.61f),
        Offset(size.width * 0.59f, size.height * 0.46f),
        Offset(size.width * 0.80f, size.height * 0.30f),
    )
    val lineProgress = (progress / 0.78f).coerceIn(0f, 1f)
    drawRisingLine(nodes, lineProgress)

    val catSize = min(size.width * 0.27f, size.height * 0.15f)
    val motion = catMotion(progress, nodes, size.height)
    drawMotionTrail(motion, catSize)
    drawFullCat(
        groundPoint = motion.groundPoint,
        catSize = catSize,
        rotation = motion.rotation,
        scaleX = motion.scaleX,
        scaleY = motion.scaleY,
        airborne = motion.airborne,
    )
}

private fun DrawScope.drawRisingLine(nodes: List<Offset>, progress: Float) {
    val segmentLengths = nodes.zipWithNext { start, end -> (end - start).getDistance() }
    val totalLength = segmentLengths.sum()
    var remaining = totalLength * progress

    nodes.zipWithNext().forEachIndexed { index, (start, end) ->
        val segmentLength = segmentLengths[index]
        val segmentProgress = (remaining / segmentLength).coerceIn(0f, 1f)
        if (segmentProgress > 0f) {
            drawLine(
                color = RisingRed,
                start = start,
                end = lerp(start, end, segmentProgress),
                strokeWidth = 6.dp.toPx(),
                cap = StrokeCap.Round,
            )
        }
        remaining -= segmentLength
    }

    var traversed = 0f
    nodes.forEachIndexed { index, node ->
        val threshold = if (index == 0) 0f else {
            traversed += segmentLengths[index - 1]
            traversed / totalLength
        }
        if (progress >= threshold) {
            val reveal = ((progress - threshold) * 9f).coerceIn(0f, 1f)
            drawCircle(RisingRed.copy(alpha = 0.16f * reveal), 15.dp.toPx(), node)
            drawCircle(RisingRed, 8.dp.toPx() * reveal, node)
            drawCircle(CatCream, 3.2.dp.toPx() * reveal, node)
        }
    }
}

private fun catMotion(progress: Float, nodes: List<Offset>, canvasHeight: Float): CatMotion = when {
    progress < 0.16f -> {
        val local = (progress / 0.16f).coerceIn(0f, 1f)
        CatMotion(
            groundPoint = nodes[0],
            rotation = -2f * local,
            scaleX = 1f + 0.08f * local,
            scaleY = 1f - 0.13f * local,
            airborne = false,
            trailStrength = 0f,
        )
    }
    progress < 0.44f -> jumpMotion(
        from = nodes[0],
        to = nodes[1],
        localProgress = (progress - 0.16f) / 0.28f,
        arcHeight = canvasHeight * 0.14f,
        rotationStart = -7f,
        rotationEnd = 4f,
    )
    progress < 0.52f -> {
        val local = (progress - 0.44f) / 0.08f
        val compression = sin(local * PI).toFloat()
        CatMotion(
            groundPoint = nodes[1],
            rotation = 0f,
            scaleX = 1f + 0.08f * compression,
            scaleY = 1f - 0.13f * compression,
            airborne = false,
            trailStrength = 0f,
        )
    }
    progress < 0.84f -> jumpMotion(
        from = nodes[1],
        to = nodes[3],
        localProgress = (progress - 0.52f) / 0.32f,
        arcHeight = canvasHeight * 0.18f,
        rotationStart = -8f,
        rotationEnd = 3f,
    )
    else -> {
        val local = ((progress - 0.84f) / 0.16f).coerceIn(0f, 1f)
        val bounce = sin(local * PI * 2.0).toFloat() * (1f - local)
        CatMotion(
            groundPoint = nodes[3] - Offset(0f, bounce * canvasHeight * 0.018f),
            rotation = 2f * bounce,
            scaleX = 1f + 0.05f * bounce.coerceAtLeast(0f),
            scaleY = 1f - 0.07f * bounce.coerceAtLeast(0f),
            airborne = false,
            trailStrength = 0f,
        )
    }
}

private fun jumpMotion(
    from: Offset,
    to: Offset,
    localProgress: Float,
    arcHeight: Float,
    rotationStart: Float,
    rotationEnd: Float,
): CatMotion {
    val t = localProgress.coerceIn(0f, 1f)
    val arc = 4f * t * (1f - t) * arcHeight
    val position = lerp(from, to, t) - Offset(0f, arc)
    return CatMotion(
        groundPoint = position,
        rotation = rotationStart + (rotationEnd - rotationStart) * t,
        scaleX = 1.12f,
        scaleY = 0.91f,
        airborne = true,
        trailStrength = sin(t * PI).toFloat(),
    )
}

private fun DrawScope.drawMotionTrail(motion: CatMotion, catSize: Float) {
    if (motion.trailStrength <= 0.02f) return
    val alpha = 0.48f * motion.trailStrength
    val start = motion.groundPoint - Offset(catSize * 0.78f, catSize * 0.32f)
    repeat(2) { index ->
        val inset = index * catSize * 0.12f
        drawLine(
            color = MotionMint.copy(alpha = alpha * (1f - index * 0.28f)),
            start = start - Offset(inset, -inset * 0.3f),
            end = start + Offset(catSize * 0.25f, -catSize * 0.12f),
            strokeWidth = 2.5.dp.toPx(),
            cap = StrokeCap.Round,
        )
    }
}

private fun DrawScope.drawFullCat(
    groundPoint: Offset,
    catSize: Float,
    rotation: Float,
    scaleX: Float,
    scaleY: Float,
    airborne: Boolean,
) {
    val center = groundPoint - Offset(0f, catSize * 0.48f)
    withTransform({
        translate(left = center.x, top = center.y)
        rotate(degrees = rotation, pivot = Offset.Zero)
        scale(scaleX = scaleX, scaleY = scaleY, pivot = Offset.Zero)
    }) {
        if (airborne) {
            drawAirborneCat(catSize)
        } else {
            drawStandingCat(catSize)
        }
    }
}

private fun DrawScope.drawStandingCat(s: Float) {
    val outline = s * 0.045f
    val tail = Path().apply {
        moveTo(-s * 0.21f, s * 0.20f)
        cubicTo(-s * 0.52f, s * 0.18f, -s * 0.50f, -s * 0.20f, -s * 0.31f, -s * 0.27f)
    }
    drawPath(tail, CatNavy, style = Stroke(outline * 2.15f, cap = StrokeCap.Round))
    drawPath(tail, CatCream, style = Stroke(outline * 1.18f, cap = StrokeCap.Round))

    drawOval(
        color = CatCream,
        topLeft = Offset(-s * 0.27f, -s * 0.04f),
        size = Size(s * 0.54f, s * 0.52f),
    )
    drawOval(
        color = CatNavy,
        topLeft = Offset(-s * 0.27f, -s * 0.04f),
        size = Size(s * 0.54f, s * 0.52f),
        style = Stroke(outline),
    )

    listOf(-0.16f, 0.08f).forEach { x ->
        drawRoundRect(
            color = CatCream,
            topLeft = Offset(s * x, s * 0.28f),
            size = Size(s * 0.14f, s * 0.24f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(s * 0.07f),
        )
        drawRoundRect(
            color = CatNavy,
            topLeft = Offset(s * x, s * 0.28f),
            size = Size(s * 0.14f, s * 0.24f),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(s * 0.07f),
            style = Stroke(outline),
        )
    }
    drawCatHead(center = Offset(0f, -s * 0.20f), s = s)
}

private fun DrawScope.drawAirborneCat(s: Float) {
    val outline = s * 0.045f
    val tail = Path().apply {
        moveTo(-s * 0.28f, s * 0.08f)
        cubicTo(-s * 0.56f, s * 0.02f, -s * 0.53f, -s * 0.29f, -s * 0.33f, -s * 0.31f)
    }
    drawPath(tail, CatNavy, style = Stroke(outline * 2.15f, cap = StrokeCap.Round))
    drawPath(tail, CatCream, style = Stroke(outline * 1.18f, cap = StrokeCap.Round))

    drawOval(
        color = CatCream,
        topLeft = Offset(-s * 0.36f, -s * 0.08f),
        size = Size(s * 0.62f, s * 0.39f),
    )
    drawOval(
        color = CatNavy,
        topLeft = Offset(-s * 0.36f, -s * 0.08f),
        size = Size(s * 0.62f, s * 0.39f),
        style = Stroke(outline),
    )

    drawLimb(Offset(s * 0.12f, s * 0.06f), Offset(s * 0.42f, s * 0.10f), s)
    drawLimb(Offset(s * 0.08f, s * 0.18f), Offset(s * 0.35f, s * 0.25f), s)
    drawLimb(Offset(-s * 0.24f, s * 0.18f), Offset(-s * 0.43f, s * 0.35f), s)
    drawLimb(Offset(-s * 0.10f, s * 0.23f), Offset(-s * 0.26f, s * 0.39f), s)
    drawCatHead(center = Offset(s * 0.23f, -s * 0.20f), s = s)
}

private fun DrawScope.drawLimb(start: Offset, end: Offset, s: Float) {
    val outline = s * 0.045f
    drawLine(CatNavy, start, end, outline * 2.35f, StrokeCap.Round)
    drawLine(CatCream, start, end, outline * 1.28f, StrokeCap.Round)
}

private fun DrawScope.drawCatHead(center: Offset, s: Float) {
    val outline = s * 0.045f
    val head = Path().apply {
        moveTo(center.x - s * 0.30f, center.y + s * 0.04f)
        cubicTo(
            center.x - s * 0.30f,
            center.y - s * 0.05f,
            center.x - s * 0.28f,
            center.y - s * 0.13f,
            center.x - s * 0.25f,
            center.y - s * 0.18f,
        )
        lineTo(center.x - s * 0.22f, center.y - s * 0.37f)
        lineTo(center.x - s * 0.07f, center.y - s * 0.27f)
        quadraticTo(center.x, center.y - s * 0.30f, center.x + s * 0.07f, center.y - s * 0.27f)
        lineTo(center.x + s * 0.22f, center.y - s * 0.37f)
        lineTo(center.x + s * 0.25f, center.y - s * 0.18f)
        cubicTo(
            center.x + s * 0.29f,
            center.y - s * 0.12f,
            center.x + s * 0.30f,
            center.y - s * 0.04f,
            center.x + s * 0.30f,
            center.y + s * 0.04f,
        )
        cubicTo(
            center.x + s * 0.30f,
            center.y + s * 0.22f,
            center.x + s * 0.16f,
            center.y + s * 0.29f,
            center.x,
            center.y + s * 0.29f,
        )
        cubicTo(
            center.x - s * 0.16f,
            center.y + s * 0.29f,
            center.x - s * 0.30f,
            center.y + s * 0.22f,
            center.x - s * 0.30f,
            center.y + s * 0.04f,
        )
        close()
    }
    drawPath(head, CatCream)
    drawPath(head, CatNavy, style = Stroke(outline, cap = StrokeCap.Round))

    val leftEar = Path().apply {
        moveTo(center.x - s * 0.205f, center.y - s * 0.30f)
        lineTo(center.x - s * 0.185f, center.y - s * 0.22f)
        lineTo(center.x - s * 0.12f, center.y - s * 0.26f)
        close()
    }
    val rightEar = Path().apply {
        moveTo(center.x + s * 0.205f, center.y - s * 0.30f)
        lineTo(center.x + s * 0.185f, center.y - s * 0.22f)
        lineTo(center.x + s * 0.12f, center.y - s * 0.26f)
        close()
    }
    drawPath(leftEar, CatOrange)
    drawPath(rightEar, CatOrange)

    listOf(-0.115f, 0.115f).forEach { x ->
        val eyeCenter = center + Offset(s * x, -s * 0.035f)
        drawOval(
            color = CatNavy,
            topLeft = eyeCenter - Offset(s * 0.041f, s * 0.063f),
            size = Size(s * 0.082f, s * 0.126f),
        )
        drawCircle(
            color = Color.White,
            radius = s * 0.015f,
            center = eyeCenter - Offset(s * 0.012f, s * 0.022f),
        )
    }

    val nose = Path().apply {
        moveTo(center.x - s * 0.026f, center.y + s * 0.075f)
        lineTo(center.x + s * 0.026f, center.y + s * 0.075f)
        lineTo(center.x, center.y + s * 0.105f)
        close()
    }
    drawPath(nose, CatNavy)

    val mouth = Path().apply {
        moveTo(center.x, center.y + s * 0.105f)
        cubicTo(
            center.x - s * 0.005f,
            center.y + s * 0.155f,
            center.x - s * 0.065f,
            center.y + s * 0.16f,
            center.x - s * 0.075f,
            center.y + s * 0.125f,
        )
        moveTo(center.x, center.y + s * 0.105f)
        cubicTo(
            center.x + s * 0.005f,
            center.y + s * 0.155f,
            center.x + s * 0.065f,
            center.y + s * 0.16f,
            center.x + s * 0.075f,
            center.y + s * 0.125f,
        )
    }
    drawPath(mouth, CatNavy, style = Stroke(s * 0.022f, cap = StrokeCap.Round))

    repeat(3) { index ->
        val y = center.y + s * (0.075f + index * 0.045f)
        val spread = s * (0.015f + index * 0.01f)
        drawLine(
            CatNavy,
            Offset(center.x - s * 0.19f, y),
            Offset(center.x - s * 0.31f, y - spread),
            s * 0.016f,
            StrokeCap.Round,
        )
        drawLine(
            CatNavy,
            Offset(center.x + s * 0.19f, y),
            Offset(center.x + s * 0.31f, y - spread),
            s * 0.016f,
            StrokeCap.Round,
        )
    }
}
