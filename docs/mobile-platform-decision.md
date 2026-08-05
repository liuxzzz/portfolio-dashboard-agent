# 移动端技术选型：原生 Android 与 Flutter

## 决策

当前版本采用 **Kotlin + Jetpack Compose 原生 Android**。Flutter 不是技术上不可行，而是与当前约束不匹配：产品首先只发布 Android，同时规划了后台同步、通知、生物识别、凭证存储和其他 Android 平台能力。

## 判断边界

| 条件 | Kotlin + Compose | Flutter |
| --- | --- | --- |
| 只交付 Android | 首选，平台 API 直接可用 | 可行，但增加 Dart/插件层 |
| 近期同时交付 iOS | 需要独立 Swift 客户端 | 一套 UI/大部分业务代码可共享 |
| Android 深度集成 | 直接、调试链路短 | 常见能力有插件，特殊能力需要 Platform Channel |
| 团队已有能力 | Kotlin/Android 团队最合适 | Dart/Flutter 团队最合适 |
| Agent 后端 | 无差异，均通过 HTTPS 调用 | 无差异，均通过 HTTPS 调用 |

如果出现明确计划：同一小团队需要在 6 个月左右同时发布功能基本一致的 iOS 版本，应重新评估 Flutter。否则继续原生，避免为尚不存在的平台需求支付持续复杂度。

## 不受客户端选择影响的部分

- Collector、Portfolio API、PostgreSQL、领域契约和 Agent Core 继续保留在 TypeScript 后端。
- 模型供应商密钥、券商会话、工具授权和审计记录不得放进移动端。
- Android 通过版本化 JSON API 消费数据；未来改为 Flutter 或增加 iOS 时仍可复用同一后端。
