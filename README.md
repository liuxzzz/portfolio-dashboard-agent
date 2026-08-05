# Portfolio Dashboard Agent

一个以“Android 原生体验 + 本地只读采集 + 标准化快照 + 证据优先分析”为核心的个人持仓产品。正式客户端使用 Kotlin 与 Jetpack Compose，Agent 编排和敏感凭证留在后端。

## 已完成的基础能力

- Android 原生客户端：概览、持仓列表、个股详情、Agent 观察四类 Compose 界面。
- 移动数据层：HTTP API、ViewModel 单向状态流、Room 缓存和明确标注的演示回退。
- 统一数据契约：账户快照、持仓、行业分布、历史曲线、Agent 运行结果。
- 证据优先 Agent：先用确定性规则检查数据新鲜度、集中度和现金缓冲。
- 快照 API：鉴权接收快照，生成分析结果，并向客户端提供聚合看板。
- 数据库：PostgreSQL 保存不可变账户快照、完整持仓、Agent 运行与证据链。
- 本地采集器：复用隔离浏览器登录会话，串联账户、持仓、当日成交、资金变化和行情接口。
- 演示模式：未配置 API 时使用完全虚构数据，不阻塞界面开发和验收。

真实接口适配与 27 列持仓标准化已经落入代码；首次使用仍需用户在本地浏览器完成一次登录验证。仓库不会提交 Cookie、券商密码、验证码或原始导出文件。

## 技术栈

- Android：Kotlin 2.3、Jetpack Compose、Navigation、Room
- 后端 Monorepo：pnpm + TypeScript
- API：Hono + Zod + Prisma ORM
- 数据库：PostgreSQL 18
- Agent：独立的 evidence-first 规则核心，可在后续接入模型
- 本地采集器：Node.js，在用户授权的登录会话中读取只读接口
- CI：GitHub Actions

## 目录

```text
apps/
  android/      正式 Kotlin / Jetpack Compose Android 客户端
  client/       仅保留作迁移参考的旧 Expo 客户端，不参与构建
  api/          快照接收、聚合查询和 Agent 运行 API
  collector/    仅在用户设备运行的只读采集器
packages/
  domain/       跨应用共享的数据契约
  agent-core/   可测试、可追溯的组合分析规则
docs/
  architecture.md
  agent-design.md
  api.md
  field-mapping.md
  prd.md
```

## 本地运行

需要 Node.js 22+、pnpm 11.9.0 和 Docker Desktop。

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:deploy
```

启动 API：

```bash
pnpm --filter @portfolio/api dev
```

本地 PostgreSQL 使用 `127.0.0.1:5433`，避免与电脑上常见的 5432 端口冲突。随后用 Android Studio 打开 `apps/android`，启动模拟器并运行 `app`。模拟器默认通过 `http://10.0.2.2:4000` 访问宿主机 API；没有快照或后端不可用时会明确显示虚构演示数据。

完整的 Android Studio、JDK、SDK、模拟器和真机配置见 [`docs/android-development.md`](docs/android-development.md)。技术选型依据见 [`docs/mobile-platform-decision.md`](docs/mobile-platform-decision.md)。

常用数据库操作：

```bash
pnpm db:status
pnpm db:studio
pnpm db:down
```

数据模型、迁移规则和生产环境注意事项见 `docs/database.md`。

## 本地采集

先复制环境变量模板，为 `INGEST_SHARED_SECRET` 设置随机值。首次使用需要在隔离的本地浏览器资料目录登录一次：

```bash
pnpm --filter @portfolio/collector run login
```

登录由用户在普通 Chrome 页面内完成；识别成功后登录窗口自动关闭。采集器不会打印或上传 Cookie，本地会话标识以仅用户可读权限保存。完成后启动 API，再执行一次采集：

```bash
pnpm --filter @portfolio/api dev
pnpm --filter @portfolio/collector run collect
```

采集器默认依次读取所有股票类账户，并只在日志中输出哈希账户标识、持仓条数和数据时间，不输出股票、金额或账户正文。详细说明见 `docs/collector.md`。

需要核验 API 与导出是否逐列一致时，可运行 `pnpm --filter @portfolio/collector run reconcile -- /绝对路径/持仓导出.xlsx`。该命令只输出脱敏的 27 列匹配统计，不上传快照。

## 验证命令

```bash
pnpm typecheck
pnpm test
TEST_DATABASE_URL='postgresql://portfolio:portfolio@127.0.0.1:5433/portfolio?schema=public' pnpm --filter @portfolio/api test
pnpm android:test
pnpm android:lint
pnpm android:assemble
```

## 安全边界

- 不保存券商账号、密码、验证码。
- 同花顺 Cookie 和浏览器登录会话只保留在用户本机。
- 服务端只接收标准化后的必要持仓字段。
- 采集写入接口默认要求 Bearer Secret，未配置时拒绝写入。
- API 默认只监听本机回环地址；补齐用户登录和加密前不得直接暴露公网。
- 不绕过验证码、登录风控或安全提示。
- Excel/CSV、浏览器用户目录和 `.env` 默认禁止提交。
- 第一阶段不自动交易，不输出确定性投资建议或收益承诺。

## 下一阶段

1. 使用同一账户刚刚生成的新导出，完成真实响应与导出的逐值对账。
2. 验证港股汇率、当日有买卖和非空清仓记录等边界情况。
3. 加入用户登录、设备绑定、生物识别门禁、字段级加密、备份与每日调度。
4. 增加快照变化分析、WorkManager 后台同步和 Android 通知渠道。
