# API v1

开发环境默认只监听 `127.0.0.1`。对公网部署前，必须先补齐用户登录、读接口授权、传输加密与数据加密，不能直接把当前服务暴露在公网。

## 健康检查

`GET /health`

## 提交快照

`POST /v1/snapshots`

- Header：`Authorization: Bearer <INGEST_SHARED_SECRET>`
- Body：符合 `portfolioSnapshotSchema` 的 JSON。
- 成功：`202`，返回快照 ID 和同步生成的 Agent Run ID。
- 未配置 Secret：`503`；鉴权失败：`401`；契约错误：`400`。

这里接收的是 Collector 标准化后的持仓快照，不接收同花顺 Cookie。

## 查询看板

`GET /v1/dashboard?accountId=<optional>`

返回最新快照、行业聚合、最近 30 个快照的资产历史和最新 Agent 运行结果。暂无快照时返回 `404`。

## 查询最新 Agent 运行

`GET /v1/agent/runs/latest?accountId=<optional>`

返回结构化观察、证据、置信度、运行时间和免责声明。
