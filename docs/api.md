# API v1

开发环境默认只监听 `127.0.0.1`。对公网部署前，必须先补齐用户登录、读接口授权、传输加密与数据加密，不能直接把当前服务暴露在公网。

## 健康检查

`GET /health`

同时检查 API 进程与 PostgreSQL 连接。两者正常返回 `200`；数据库不可用返回 `503`。

## 提交快照

`POST /v1/snapshots`

- Header：`Authorization: Bearer <INGEST_SHARED_SECRET>`
- Body：符合 `portfolioSnapshotSchema` 的 JSON。
- 成功：`202`，返回快照 ID 和同步生成的 Agent Run ID。
- 未配置 Secret：`503`；鉴权失败：`401`；契约错误：`400`。
- 同一快照可安全重试；内容一致时复用已保存快照和 Agent Run，不产生重复记录。
- 相同快照 ID 但内容不同会被拒绝，历史记录不会被静默覆盖。

这里接收的是 Collector 标准化后的持仓快照，不接收同花顺 Cookie。

## 查询看板

`GET /v1/dashboard?accountId=<optional>`

返回最新快照、行业聚合、最近 30 个快照的资产历史和最新 Agent 运行结果。暂无快照时返回 `404`。

配置 `TUSHARE_TOKEN` 后，响应中的持仓 `industry`、`relatedSector`、`sectorRate` 会使用对应快照时间有效的申万行业数据增强；`industries[].dayRate` 是申万一级行业日涨跌率。`industryData` 披露分类体系、来源、同步状态和缓存时间。外部行业服务失败不会使看板失败。

## 刷新行业数据

`POST /v1/industries/refresh?accountId=<optional>`

- Header：`Authorization: Bearer <INGEST_SHARED_SECRET>`。
- 强制刷新最新快照涉及证券的申万行业映射和行业日线。
- 返回行业数量与 `industryData` 同步状态。
- 未配置写入密钥返回 `503`，鉴权失败返回 `401`，暂无快照返回 `404`。

## 查询最新 Agent 运行

`GET /v1/agent/runs/latest?accountId=<optional>`

返回结构化观察、证据、置信度、运行时间和免责声明。

## 重新运行 Agent

`POST /v1/agent/runs?accountId=<optional>`

基于该账户的最新快照重新执行 evidence-first 分析，保存并返回新的结构化 Agent Run。暂无快照时返回 `404`。当前只生成带证据的风险观察，不调用交易工具。
