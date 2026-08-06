# API v1

开发环境默认只监听 `127.0.0.1`。公网部署必须使用 HTTPS；除健康检查、发送验证码、验证码登录和可信采集写入外，所有 `/v1` 接口都要求用户会话。

## 健康检查

`GET /health`

同时检查 API 进程与 PostgreSQL 连接。两者正常返回 `200`；数据库不可用返回 `503`。

## 手机号登录

`POST /v1/auth/sms-codes`

- Body：`{"phone":"13800138000"}`，当前支持中国大陆手机号，也接受 `+86` 前缀。
- 使用阿里云号码认证服务 `SendSmsVerifyCode` 和系统赠送签名/模板发送 6 位验证码；验证码 5 分钟有效、60 秒内不能重发、每小时最多 10 条。
- 数据库只保存带 `AUTH_SECRET` 的验证码摘要；错误 5 次或成功使用后立即作废。

`POST /v1/auth/sessions`

- Body：`{"phone":"13800138000","code":"123456"}`。
- 验证成功会自动创建用户，返回随机 `accessToken`、30 天有效期和脱敏用户信息。
- 后续请求使用 `Authorization: Bearer <accessToken>`。数据库只保存令牌 SHA-256 摘要。

`GET /v1/auth/me` 返回当前脱敏用户；`DELETE /v1/auth/session` 撤销当前会话。

## 上传 XLSX 持仓

`POST /v1/imports/xlsx`

这个接口面向已登录用户，不使用 Collector 的全局写入密钥，也不接受手机号或 `userId` 指定数据归属。服务端只从 `Authorization` 中的用户会话取得 `userId`，解析后的账户、快照、持仓和 Agent Run 全部写入该用户名下。

- Header：`Authorization: Bearer <用户 accessToken>`
- Content-Type：`multipart/form-data`
- `file`：必填，同花顺“持仓数据”导出的 `.xlsx` 文件，最大 10 MiB。
- `accountId`：可选，同一用户内稳定标识该导入组合，默认 `xlsx-upload`，最长 128 个字符。
- `accountName`：可选，默认 `Excel 上传组合`，最长 100 个字符。
- `capturedAt`：可选，ISO 8601 时间；未提供时使用服务端接收时间。

```bash
curl -X POST http://127.0.0.1:4000/v1/imports/xlsx \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "file=@/绝对路径/持仓导出.xlsx;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -F "accountId=my-tzzb-export" \
  -F "accountName=我的持仓"
```

首次成功导入返回 `201`；相同用户重复提交相同快照返回 `200` 且 `duplicate=true`。未登录返回 `401`，文件缺失或内容不符合 27 列持仓合约返回 `400`，非 XLSX 返回 `415`，超过大小限制返回 `413`。

## 提交快照

`POST /v1/snapshots`

- Header：`Authorization: Bearer <INGEST_SHARED_SECRET>`
- Header：`X-Portfolio-User: <已登录的目标手机号>`
- Body：符合 `portfolioSnapshotSchema` 的 JSON。
- 成功：`202`，返回快照 ID 和同步生成的 Agent Run ID。
- 未配置 Secret：`503`；鉴权失败：`401`；契约错误：`400`。
- 同一快照可安全重试；内容一致时复用已保存快照和 Agent Run，不产生重复记录。
- 相同快照 ID 但内容不同会被拒绝，历史记录不会被静默覆盖。
- 目标手机号必须已完成一次验证码登录。API 从手机号解析内部 `userId`，不会信任快照正文声明用户归属。

这里接收的是 Collector 标准化后的持仓快照，不接收同花顺 Cookie。

## 查询看板

`GET /v1/dashboard?accountId=<optional>`

要求用户 Bearer 会话。返回当前用户的最新快照、行业聚合、最近 30 个快照的资产历史和最新 Agent 运行结果。`accountId` 也只能命中当前用户账户；其他用户的数据统一表现为不存在。

默认配置 `INDUSTRY_PROVIDER=eastmoney`，响应中的持仓 `industry`、`relatedSector`、`sectorRate` 会使用东方财富行业资料和本地 ETF 规则增强；`industries[].dayRate` 是可匹配行业板块的日涨跌率。设置为 `tushare` 时改用申万行业数据，并要求配置 `TUSHARE_TOKEN`。`industryData` 披露分类体系、来源、同步状态和缓存时间。外部行业服务失败不会使看板失败。

响应中的 `industryTags` 是当前用户自己创建的标签；持仓的 `industryTagId` 非空且 `industryTagged=true` 时，`industry` 使用用户标签并参与首页行业聚合，否则继续使用数据源自动分类。

## 行业标签管理

所有接口都要求用户 Bearer 会话，并只读写当前 `userId` 的数据：

- `GET /v1/industry-tags`：列出当前用户标签。
- `POST /v1/industry-tags`：Body 为 `{"name":"高股息","color":"#3E6FCA"}`。名称 1–20 个字符、同一用户内不可重名，最多 30 个标签。
- `DELETE /v1/industry-tags/:tagId`：删除当前用户标签；已使用该标签的股票解除关联，重新显示数据源自动行业。
- `PUT /v1/positions/:market/:symbol/industry-tag?accountId=<optional>`：Body 为 `{"tagId":"..."}`，给当前用户持仓选择一个标签。
- `DELETE /v1/positions/:market/:symbol/industry-tag?accountId=<optional>`：取消标签，恢复数据源自动行业。

标签、账户和持仓都会校验用户归属；其他用户的标签和账户统一表现为不存在。

## 刷新行业数据

`POST /v1/industries/refresh?accountId=<optional>`

- Header：`Authorization: Bearer <用户 accessToken>`。
- 强制刷新最新快照涉及证券的当前数据源行业映射和行业日线。
- 返回行业数量与 `industryData` 同步状态。
- 未配置写入密钥返回 `503`，鉴权失败返回 `401`，暂无快照返回 `404`。

## 查询最新 Agent 运行

`GET /v1/agent/runs/latest?accountId=<optional>`

返回结构化观察、证据、置信度、运行时间和免责声明。

## 重新运行 Agent

`POST /v1/agent/runs?accountId=<optional>`

基于该账户的最新快照重新执行 evidence-first 分析，保存并返回新的结构化 Agent Run。暂无快照时返回 `404`。当前只生成带证据的风险观察，不调用交易工具。
