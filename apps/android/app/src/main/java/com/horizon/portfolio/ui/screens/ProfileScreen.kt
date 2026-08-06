package com.horizon.portfolio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import com.horizon.portfolio.domain.model.IndustryTag
import com.horizon.portfolio.ui.theme.Accent
import com.horizon.portfolio.ui.theme.AccentSoft
import com.horizon.portfolio.ui.theme.Ink
import com.horizon.portfolio.ui.theme.Muted

private val tagColors = listOf(
    "#3E6FCA",
    "#5BC5A7",
    "#F3B45A",
    "#7C8BE8",
    "#D96C8B",
    "#8B98A9",
    "#E07A5F",
    "#2A9D8F",
)

@Composable
fun ProfileScreen(
    maskedPhone: String,
    industryTags: List<IndustryTag>,
    isCreatingTag: Boolean,
    deletingTagId: String?,
    message: String?,
    isLoggingOut: Boolean,
    showDashboardRetry: Boolean = false,
    onCreateTag: (String, String) -> Unit,
    onDeleteTag: (String, String) -> Unit,
    onRefreshDashboard: () -> Unit,
    onLogout: () -> Unit,
) {
    var tagName by rememberSaveable { mutableStateOf("") }
    var selectedColor by rememberSaveable { mutableStateOf(tagColors.first()) }
    var pendingDelete by rememberSaveable { mutableStateOf<Pair<String, String>?>(null) }

    pendingDelete?.let { (tagId, name) ->
        AlertDialog(
            onDismissRequest = { if (deletingTagId == null) pendingDelete = null },
            title = { Text("删除行业标签？") },
            text = { Text("删除“$name”后，使用它的股票会恢复数据源自动分类。") },
            confirmButton = {
                TextButton(
                    enabled = deletingTagId == null,
                    onClick = {
                        onDeleteTag(tagId, name)
                        pendingDelete = null
                    },
                ) { Text("删除") }
            },
            dismissButton = {
                TextButton(
                    enabled = deletingTagId == null,
                    onClick = { pendingDelete = null },
                ) { Text("取消") }
            },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 30.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "我的",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Text(text = maskedPhone, style = MaterialTheme.typography.titleMedium)
        Text(
            text = "持仓、历史记录、行业标签与 Agent 观察均按此账户隔离。",
            style = MaterialTheme.typography.bodyMedium,
            color = Muted,
        )
        if (showDashboardRetry) {
            OutlinedButton(
                onClick = onRefreshDashboard,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("重新加载组合")
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
            text = "行业标签管理",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = "创建你自己的分类，再到股票详情中选择标签。最多 30 个。",
            style = MaterialTheme.typography.bodySmall,
            color = Muted,
        )
        OutlinedTextField(
            value = tagName,
            onValueChange = { tagName = it.take(20) },
            label = { Text("标签名称") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("标签颜色", style = MaterialTheme.typography.labelLarge)
        tagColors.chunked(4).forEach { rowColors ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                rowColors.forEach { colorHex ->
                    val selected = selectedColor == colorHex
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .background(Color(colorHex.toColorInt()), CircleShape)
                            .then(
                                if (selected) {
                                    Modifier.border(3.dp, Ink, CircleShape)
                                } else {
                                    Modifier
                                },
                            )
                            .clickable { selectedColor = colorHex },
                    )
                }
            }
        }
        Button(
            enabled = tagName.trim().isNotEmpty() &&
                !isCreatingTag &&
                industryTags.size < 30,
            onClick = {
                val name = tagName.trim()
                onCreateTag(name, selectedColor)
                tagName = ""
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (isCreatingTag) {
                CircularProgressIndicator(Modifier.size(20.dp))
            } else {
                Text("新增标签")
            }
        }

        if (industryTags.isEmpty()) {
            Text(
                text = "还没有自定义标签。",
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
                modifier = Modifier.padding(vertical = 12.dp),
            )
        } else {
            industryTags.sortedBy(IndustryTag::sortOrder).forEach { tag ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AccentSoft, RoundedCornerShape(16.dp))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            Modifier
                                .size(14.dp)
                                .background(Color(tag.color.toColorInt()), CircleShape),
                        )
                        Text(tag.name, color = Ink, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        enabled = deletingTagId == null,
                        onClick = { pendingDelete = tag.id to tag.name },
                    ) {
                        Text(if (deletingTagId == tag.id) "删除中…" else "删除")
                    }
                }
            }
        }
        message?.takeIf(String::isNotBlank)?.let {
            Text(it, color = Accent, style = MaterialTheme.typography.bodySmall)
        }

        HorizontalDivider(modifier = Modifier.padding(top = 10.dp))
        Button(
            onClick = onLogout,
            enabled = !isLoggingOut,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp),
        ) {
            Text(if (isLoggingOut) "退出中…" else "退出登录")
        }
    }
}
