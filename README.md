# Portfolio Dashboard Agent

一个以“本地只读采集 + 加密快照 + 响应式看板”为核心的个人持仓 Agent。

## 当前状态

仓库处于技术验证阶段。当前只建立应用边界、数据契约和安全默认值，尚未实现真实账户采集。

## 技术栈

- Monorepo：pnpm + TypeScript
- Web/PWA：Next.js + React + ECharts
- API：Hono + Zod
- 数据：PostgreSQL + Drizzle ORM
- 本地采集器：Node.js + Playwright
- CI：GitHub Actions

## 目录

```text
apps/
  api/        快照接收和查询 API
  collector/  仅在本机运行的持仓采集器
  web/        电脑和手机响应式看板
packages/
  domain/     跨应用共享的数据结构
docs/
  architecture.md
  field-mapping.md
  prd.md
```

## 安全边界

- 不保存券商账号、密码、验证码。
- 同花顺登录会话只保留在用户本机。
- 云端只接收标准化后的必要持仓字段。
- 不绕过验证码、登录风控或安全提示。
- Excel/CSV 导出、浏览器用户目录和 `.env` 默认禁止提交。
- 第一阶段不做自动交易或收益承诺。

## 本地启动

```bash
pnpm install
cp .env.example .env
pnpm dev
```

默认端口：Web `3000`，API `4000`。

## 下一步

1. 在用户已登录的本地浏览器中完成一次只读 API 验证。
2. 保存脱敏后的接口契约样本。
3. 实现采集字段标准化和导出文件自动对账。
4. 建立 PostgreSQL 快照表和首版持仓看板。

