# Portfolio Dashboard Agent

一个以“本地只读采集 + 标准化快照 + 证据优先分析”为核心的个人持仓产品。Web、iOS 和 Android 使用同一套 Expo/React Native 代码。

## 已完成的基础能力

- 通用客户端：概览、持仓列表、个股详情、Agent 观察四类界面。
- 跨端构建：同一套路由、组件和业务逻辑导出 Web、iOS、Android。
- 统一数据契约：账户快照、持仓、行业分布、历史曲线、Agent 运行结果。
- 证据优先 Agent：先用确定性规则检查数据新鲜度、集中度和现金缓冲。
- 快照 API：鉴权接收快照，生成分析结果，并向客户端提供聚合看板。
- 演示模式：未配置 API 时使用完全虚构数据，不阻塞界面开发和验收。

真实同花顺账户采集仍是下一阶段；仓库不会提交 Cookie、券商密码、验证码或原始导出文件。

## 技术栈

- Monorepo：pnpm + TypeScript
- Web / iOS / Android：Expo Router + React Native Web
- 状态与请求：TanStack Query
- 图表：React Native SVG
- API：Hono + Zod
- Agent：独立的 evidence-first 规则核心，可在后续接入模型
- 本地采集器：Node.js，后续在用户授权的登录会话中读取只读接口
- CI：GitHub Actions

## 目录

```text
apps/
  client/       Web、iOS、Android 共用的产品客户端
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

需要 Node.js 22+ 和 pnpm 11.9.0。

```bash
pnpm install
pnpm --filter @portfolio/client dev
```

Expo 启动后可在浏览器、iOS Simulator 或 Android Emulator 打开同一个应用。客户端未配置 API 时会明确显示“演示数据”。

如需联调 API：

```bash
cp .env.example .env
pnpm --filter @portfolio/api dev
```

然后在 `apps/client/.env` 设置：

```text
EXPO_PUBLIC_API_URL=http://localhost:4000
```

## 验证命令

```bash
pnpm typecheck
pnpm test
pnpm build:web
pnpm build:ios
pnpm build:android
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

1. 在用户已登录的本地浏览器中完成只读接口采集。
2. 使用官方导出文件做自动字段对账。
3. 将内存仓储替换为 PostgreSQL 不可变快照。
4. 加入登录、设备绑定、加密与每日调度。
