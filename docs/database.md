# Database

## 数据模型

PostgreSQL 保存用户认证、私有组合数据与公共行业参考数据：

- `users`：手机号用户；手机号唯一，历史占位用户不可登录。
- `sms_verification_codes`：验证码摘要、有效期、尝试次数和消费时间，不保存验证码明文。
- `auth_sessions`：随机会话令牌的 SHA-256 摘要、有效期和撤销时间，不保存令牌明文。
- `accounts`：带 `userId` 归属的同花顺账户稳定身份，只保存标准化账户信息。
- `snapshots`：一次采集的账户汇总、数据时间、版本号与内容哈希。
- `positions`：该快照下的完整持仓字段；金额使用定点小数，避免浮点累计误差。
- `industry_tags`：用户私有的行业标签名称、颜色与排序；同一用户内名称唯一。
- `security_industry_overrides`：账户内每只股票选择的用户标签；删除标签时关联自动级联删除并恢复数据源分类。
- `security_industry_memberships`：带有效起止日期的证券—申万行业映射，保留一、二、三级分类及来源。
- `industry_market_bars`：申万一级行业日线与抓取时间。
- `agent_runs`：一次组合分析运行及状态。
- `agent_insights`：结构化观察、严重程度、置信度与说明。
- `agent_evidence`：每条观察所引用的快照、持仓或计算证据。

一个用户有多个账户，一个账户有多个快照；快照拥有当时的持仓与分析记录。所有账户、快照、行业自定义、历史与 Agent 查询都由当前会话的 `userId` 约束。外部快照 ID 会映射为用户级内部主键，两个用户即使提交相同外部 ID 也不会碰撞。快照以账户和采集时间唯一，保存后不允许修改。

升级迁移会把原有账户先归到不可登录的 `legacy-unassigned` 用户，保证旧数据不会被任意登录用户读取。之后可信 Collector 为真实手机号首次上传同一来源账户时，会把对应旧账户及历史整体转交给该用户。

行业映射与行情属于外部参考数据，和 Collector 提交的事实快照分表保存。查询看板时按快照时间选择有效分类并生成增强响应，因此后续行业调整不会覆写历史持仓。用户标签只影响增强后的分类与聚合，不修改不可变快照；标签和股票关联都通过账户归属约束到当前 `userId`。

Prisma 模型位于 `apps/api/prisma/schema.prisma`，已提交的迁移位于 `apps/api/prisma/migrations`。生成的 Prisma Client 不提交 Git，在安装、构建和测试前自动生成。

## 本地使用

```bash
cp .env.example .env
pnpm db:up
pnpm db:deploy
pnpm db:status
```

本项目默认把容器数据库映射到 `127.0.0.1:5433`。数据库文件保存在 Docker 命名卷中，执行 `pnpm db:down` 只停止并移除容器，不会删除数据卷。

需要浏览表和记录时运行：

```bash
pnpm db:studio
```

## 变更模型

开发时先修改 Prisma Schema，再创建并检查迁移：

```bash
pnpm --filter @portfolio/api exec prisma migrate dev --config prisma.config.ts --name describe_change
```

生产和 CI 只执行已提交迁移：

```bash
pnpm db:deploy
```

不要手改已在共享环境执行过的迁移；后续变化应新增迁移。上线前需要为托管 PostgreSQL 配置独立账号、强密码、TLS、自动备份与定期恢复演练，不能沿用本地示例凭据。
