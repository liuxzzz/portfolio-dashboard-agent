# Database

## 数据模型

PostgreSQL 保存六类关系数据：

- `accounts`：同花顺账户的稳定身份，只保存标准化账户信息。
- `snapshots`：一次采集的账户汇总、数据时间、版本号与内容哈希。
- `positions`：该快照下的完整持仓字段；金额使用定点小数，避免浮点累计误差。
- `agent_runs`：一次组合分析运行及状态。
- `agent_insights`：结构化观察、严重程度、置信度与说明。
- `agent_evidence`：每条观察所引用的快照、持仓或计算证据。

一个账户有多个快照；快照拥有当时的持仓与分析记录。快照以账户和采集时间唯一，保存后不允许修改。重复上传相同快照会直接复用，内容冲突则拒绝覆盖。

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
