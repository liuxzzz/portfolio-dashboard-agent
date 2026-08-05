package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.horizon.portfolio.domain.model.AgentRun
import com.horizon.portfolio.ui.components.PageHeader
import com.horizon.portfolio.ui.components.formatTime
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Canvas
import com.horizon.portfolio.ui.theme.Info
import com.horizon.portfolio.ui.theme.InfoSoft
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted
import com.horizon.portfolio.ui.theme.MutedDark
import com.horizon.portfolio.ui.theme.Danger
import com.horizon.portfolio.ui.theme.DangerSoft
import com.horizon.portfolio.ui.theme.Warning
import com.horizon.portfolio.ui.theme.WarningSoft

@Composable
fun AgentScreen(
    run: AgentRun?,
    isRunning: Boolean,
    message: String?,
    onRunAgent: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.background(Canvas),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            PageHeader(
                eyebrow = "EVIDENCE-FIRST AGENT",
                title = "组合观察",
                subtitle = "事实规则先行，模型解释后置，每条结论都能回到证据。",
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth().background(AccentSoft, RoundedCornerShape(22.dp)).padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("盾", color = Ink, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                Column(Modifier.weight(1f).padding(horizontal = 14.dp)) {
                    Text("当前运行：确定性规则引擎", color = Ink, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                    Text(
                        "检查数据新鲜度、集中度和现金缓冲；不生成买卖指令。模型解释层将保持同一证据边界。",
                        color = MutedDark,
                        fontSize = 12.sp,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
                Button(onClick = onRunAgent, enabled = !isRunning) {
                    if (isRunning) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("重新分析")
                }
            }
        }

        message?.let {
            item { Text(it, color = MutedDark, fontSize = 12.sp) }
        }

        if (run == null) {
            item { Text("暂无 Agent 运行记录。连接后端后点击“重新分析”。", color = Muted) }
        } else {
            items(run.insights, key = { it.id }) { insight ->
                val tone = severityTone(insight.severity)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(),
                    border = CardDefaults.outlinedCardBorder(),
                    shape = RoundedCornerShape(18.dp),
                ) {
                    Row(Modifier.padding(18.dp)) {
                        Text(
                            text = if (insight.severity == "info") "i" else "!",
                            color = tone.foreground,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier
                                .background(tone.background, RoundedCornerShape(12.dp))
                                .padding(horizontal = 13.dp, vertical = 9.dp),
                        )
                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text(insight.title, color = Ink, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                            Text(
                                insight.summary,
                                color = MutedDark,
                                fontSize = 13.sp,
                                lineHeight = 20.sp,
                                modifier = Modifier.padding(top = 7.dp),
                            )
                            insight.evidence.firstOrNull()?.let { evidence ->
                                Text(
                                    "证据 · ${evidence.label} · ${formatTime(evidence.asOf)}",
                                    color = Muted,
                                    fontSize = 10.sp,
                                    modifier = Modifier.padding(top = 12.dp),
                                )
                            }
                        }
                    }
                }
            }
            item {
                Text(run.disclaimer, color = Muted, fontSize = 10.sp, lineHeight = 17.sp)
            }
        }
    }
}

private data class SeverityTone(val foreground: Color, val background: Color)

private fun severityTone(severity: String): SeverityTone = when (severity) {
    "risk" -> SeverityTone(Danger, DangerSoft)
    "attention" -> SeverityTone(Warning, WarningSoft)
    else -> SeverityTone(Info, InfoSoft)
}
