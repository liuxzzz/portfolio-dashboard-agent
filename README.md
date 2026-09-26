# Portfolio Dashboard Agent

一个以 Web 为主要入口、Android 为便捷客户端的个人持仓产品。两端共用 Portfolio API、账户、标准化快照和证据优先的 Agent 服务；敏感凭证与 Agent 编排留在后端。

## 已完成的基础能力

- Web 主入口：手机号登录、组合概览、全部持仓、个股详情、行业标签管理、XLSX 导入、Agent 观察、证据和原始 Run 检查。
- Android 便捷客户端：概览、持仓列表、个股详情、Agent 观察和“我的” Compose 界面。
- 移动数据层：HTTP API、ViewModel 单向状态流和按用户隔离的 Room 缓存；Web 在当前标签页缓存最近一次有效看板。
- 统一数据契约：账户快照、持仓、行业分布、历史曲线、Agent 运行结果。
- 证据优先 Agent：先用确定性规则检查数据新鲜度、集中度和现金缓冲。
- 快照 API：鉴权接收快照，生成分析结果，并向客户端提供聚合看板。
- 用户登录：手机号 + 阿里云短信验证码，随机会话令牌只以摘要形式落库。
- 用户隔离：账户、快照、历史、行业自定义、Agent 结果与 Android 离线缓存均按用户隔离。
- 行业标签：用户可在“我的”页面新增、选择颜色和删除私有标签，并在股票详情选择标签或恢复自动行业分类。
- 数据库：PostgreSQL 保存不可变账户快照、完整持仓、Agent 运行与证据链。
- 行业增强：后端默认从东方财富获取行业资料，也可配置 Tushare 申万 2021 数据；缓存后合并到看板，不改写原始快照。
- 本地采集器：复用隔离浏览器登录会话，串联账户、持仓、当日成交、资金变化和行情接口。
- 演示样本只用于本地开发和验收；正式 Web 页面不会把样本数据当成账户持仓。

真实接口适配与 27 列持仓标准化已经落入代码；首次使用仍需用户在本地浏览器完成一次登录验证。仓库不会提交 Cookie、券商密码、验证码或原始导出文件。

## 技术栈

- Android：Kotlin 2.3、Jetpack Compose、Navigation、Room
- Web：React + Vite + TypeScript + Tailwind CSS + shadcn/ui，按 FSD 分层并复用 `@portfolio/domain` 契约
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
  web/          Web 主入口；app/pages/widgets/features/entities/shared 分层
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

已完成 Android Studio、SDK 和 `.env` 配置后，可一键启动数据库、迁移、API、Android 模拟器并安装运行 Debug App：

```bash
pnpm dev:android
```

默认优先使用 `Pixel_10a`，也可通过 `PORTFOLIO_ANDROID_AVD=<模拟器名称> pnpm dev:android` 指定其他 AVD。再次执行会复用已经运行的 API 和模拟器。

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:deploy
```

启动前还需在 `.env` 配置 `AUTH_SECRET`、阿里云 RAM AccessKey，以及号码认证控制台当前可用的系统赠送签名和登录/注册模板。建议只授予 RAM 用户 `dypns:SendSmsVerifyCode` 权限；后端使用阿里云官方 `dypnsapi20170525` SDK，密钥不会进入 Android 或 Collector。个人实名认证账号可使用短信认证产品，无需企业短信资质，但系统赠送签名和模板必须配套使用。

启动 API：

```bash
pnpm --filter @portfolio/api dev
```

本地 PostgreSQL 使用 `127.0.0.1:5433`，避免与电脑上常见的 5432 端口冲突。随后用 Android Studio 打开 `apps/android`，启动模拟器并运行 `app`。模拟器默认通过 `http://10.0.2.2:4000` 访问宿主机 API；没有快照时显示空态，后端不可用时可读取当前用户的本机缓存。

### Web 主入口

数据库迁移与 API 配置完成后，在两个终端分别运行：

```bash
pnpm dev
pnpm dev:web
```

浏览器打开 `http://127.0.0.1:5173`。Web 开发服务器把 `/v1` 和 `/health` 代理到 `http://127.0.0.1:4000`；如 API 使用其他端口，可在 `apps/web/.env.local` 设置 `WEB_API_TARGET`（参考 `apps/web/.env.example`）。

使用现有手机号验证码登录后，Web 可以浏览组合概览、行业分布、全部持仓和详情，管理私有行业标签、导入同花顺持仓 XLSX、触发 `POST /v1/agent/runs`，并查看观察证据与原始 Run。金额默认隐藏。会话和按用户隔离的最近一次有效看板仅保存在当前浏览器标签页的 `sessionStorage`；退出登录会清除本地缓存。Web 不接触采集器的 Cookie 或写入密钥。当前 Agent 服务仍是确定性规则分析，Web 不伪造模型或工具调用结果。正式部署 Web 时，需要在同一站点把 `/v1` 和 `/health` 反向代理到 Portfolio API，并使用 HTTPS。Web 架构及 AI 辅助开发规范见 [`AGENTS.md`](AGENTS.md)。

完整的 Android Studio、JDK、SDK、模拟器和真机配置见 [`docs/android-development.md`](docs/android-development.md)。技术选型依据见 [`docs/mobile-platform-decision.md`](docs/mobile-platform-decision.md)。

常用数据库操作：

```bash
pnpm db:status
pnpm db:studio
pnpm db:down
```

数据模型、迁移规则和生产环境注意事项见 `docs/database.md`。

## 行业数据

默认使用免费的东方财富公开网页接口，不需要注册或 Token。看板会补齐 A 股和港股所属行业；A 股行业与主题 ETF 还会尽量关联行业板块日涨跌。ETF 使用基金名称规则归类，无法可靠匹配的宽基基金归为“指数基金”：

```bash
INDUSTRY_PROVIDER=eastmoney
```

如果已有 Tushare 对应权限，也可以显式切回申万行业数据：

```bash
INDUSTRY_PROVIDER=tushare
TUSHARE_TOKEN=your-personal-token
TUSHARE_API_URL=https://api.tushare.pro
```

也可以设置 `INDUSTRY_PROVIDER=disabled` 完全关闭外部行业数据。首次查询看板时自动同步，行业分类缓存 24 小时、行情缓存 15 分钟。也可以使用与快照写入相同的 Bearer Secret 调用 `POST /v1/industries/refresh` 强制刷新。外部服务失败时，看板仍然可用，并回退到同一分类体系的数据库缓存或快照自带行业。

东方财富公开网页接口没有服务等级承诺，字段和访问策略可能变化，因此只用于当前个人看板，并保留本地缓存和明确的同步状态。对外提供服务前必须确认数据授权或更换具备相应许可的数据源。Tushare Token 如启用，只由 API 读取，不进入 Collector、Android APK、日志或看板响应。

## 本地采集

先复制环境变量模板，为 `INGEST_SHARED_SECRET` 设置随机值，并把 `PORTFOLIO_USER_PHONE` 设为已在 Android 端完成验证码登录的手机号。首次使用还需要在隔离的本地浏览器资料目录登录一次：

```bash
pnpm --filter @portfolio/collector run login
```

登录由用户在普通 Chrome 页面内完成；识别成功后登录窗口自动关闭。采集器不会打印或上传 Cookie，本地会话标识以仅用户可读权限保存。完成后启动 API，再执行一次采集：

```bash
pnpm --filter @portfolio/api dev
pnpm --filter @portfolio/collector run collect
```

也可以先从同花顺“持仓数据”Excel 导出跑通本地链路，无需浏览器登录：

```bash
pnpm --filter @portfolio/collector run import:xlsx -- /绝对路径/data.xlsx
```

导入会核对 27 列持仓合约与汇总行，逐行计算股票市值、当日盈亏和仓位；总资产与可用现金按导出仓位反推。由于导出仓位只保留有限小数，可用现金属于近似值。相同文件与时间重复导入会复用同一快照。

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
- 所有私有读接口要求用户会话，并在仓储层强制带 `userId` 查询；采集写入还必须指定已登录的目标手机号。
- 验证码 5 分钟失效、最多错误 5 次并限制发送频率；数据库不保存验证码或访问令牌明文，Android 会用 Keystore AES-GCM 加密本地会话令牌并禁止备份私有数据。
- API 默认只监听本机回环地址；公网部署必须使用 HTTPS 并完成阿里云短信和生产密钥配置。
- 不绕过验证码、登录风控或安全提示。
- Excel/CSV、浏览器用户目录和 `.env` 默认禁止提交。
- 第一阶段不自动交易，不输出确定性投资建议或收益承诺。

## 下一阶段

1. 使用同一账户刚刚生成的新导出，完成真实响应与导出的逐值对账。
2. 验证港股汇率、当日有买卖和非空清仓记录等边界情况。
3. 加入设备绑定、生物识别门禁、字段级加密、备份与每日调度。
4. 增加快照变化分析、WorkManager 后台同步和 Android 通知渠道。
