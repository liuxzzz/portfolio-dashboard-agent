# Local Collector

## 作用

Collector 在用户设备上运行，通过隔离的 Chrome 资料目录保留用户主动建立的同花顺登录会话。首次登录使用普通 Chrome，日常采集使用无界面浏览器上下文调用网页当前使用的同源只读接口，在内存中完成字段标准化，再把 `PortfolioSnapshot` 上传到本机 API。

Cookie、验证码、券商账号和原始接口正文不会上传，也不会写入日志。

## 首次登录

1. 从 `.env.example` 复制本地 `.env`，设置随机 `INGEST_SHARED_SECRET`。
2. 运行 `pnpm --filter @portfolio/collector run login`。
3. 在打开的浏览器中由用户本人完成登录或验证码。
4. 页面进入投资账本后，浏览器自动关闭；Cookie 和捕获到的本地用户标识只保存在 `TZZB_PROFILE_DIR`。

遇到验证码或风控时，Collector 不做自动破解，必须由用户在页面内处理。

## 采集链路

每次 `collect` 严格执行：

1. `account_list`：发现手工、普通股票和融资融券账户。
2. `stock_position`：读取账户金额与基础持仓。
3. `merge_day_trading`：读取当日成交，修正当日盈亏。
4. `query_bank_history`：读取当日资金变化，修正日收益率分母。
5. `pass_quotes`：读取最新价与昨收，更新市值、盈亏和周期字段。
6. 共享 Zod 契约校验标准化快照。
7. 配置 API 时，使用 Bearer Secret 上传；未配置时只验证并输出脱敏摘要。

任何关键接口失败都会使本次账户采集失败，不会静默用零或旧值补齐。

真实登录后可运行 `pnpm --filter @portfolio/collector run audit`。该命令不会上传快照，只输出 27 个导出字段的 `complete`、`partial`、`empty` 或 `blank-by-source` 覆盖状态和记录数，不输出股票代码、名称或金额。

若要逐值核对同花顺导出，在登录有效且刚刚导出文件后运行：

```bash
pnpm --filter @portfolio/collector run reconcile -- /绝对路径/持仓导出.xlsx
```

`reconcile` 会在内存中按股票代码对齐 API 快照和“持仓数据”工作表，忽略账户汇总行，并按导出的实际精度比较 27 列。报告只包含每列的匹配数、差异数、单边空值数和容差，不包含代码、名称、金额或文件路径；发现差异时退出码为 `2`。该命令不会上传快照。

## Excel 快照导入

在不启动浏览器采集时，可以把同花顺导出的“持仓数据”工作表直接转换成标准化快照并上传到本机 API：

```bash
pnpm --filter @portfolio/collector run import:xlsx -- /绝对路径/持仓导出.xlsx
```

导入流程会验证固定的 27 列字段顺序，保留完整持仓扩展字段，并将逐行合计与“汇总”行核对。股票市值、当日盈亏和仓位来自持仓逐行合计并与汇总值校验；总资产和可用现金按以下口径计算：

```text
总资产 = 股票市值 / 股票仓位
可用现金 = 总资产 - 股票市值
```

导出仓位只保留有限小数，因此总资产和可用现金是近似值。Excel 不包含可信的账户更新时间，快照时间使用文件修改时间，数据新鲜度标记为 `unknown`。文件内容和时间相同时生成稳定快照 ID，重复导入不会创建重复持仓或 Agent 运行。

## 本地配置

- `TZZB_PROFILE_DIR`：隔离资料目录，默认 `browser-profile/tzzb`。
- `TZZB_BROWSER_CHANNEL`：默认使用本机 Chrome。
- `TZZB_CHROME_EXECUTABLE`：可选，Google Chrome 安装在非标准位置时填写完整路径。
- `TZZB_HEADLESS`：日常采集默认 `true`；排查登录问题时可临时改为 `false`。
- `TZZB_ACCOUNT_IDS`：可选，逗号分隔；留空采集所有股票账户。
- `TZZB_USER_ID`：通常无需填写；首次登录会从成功的账户请求中自动捕获并保存在本机。
- `TZZB_CDP_URL`：仅用于开发排查，连接到用户主动启动的本地调试 Chrome；日常任务无需配置。
- `TZZB_RATE_UNIT`：当前网页返回百分数单位，默认 `percent`。
- `PORTFOLIO_API_URL`：标准化快照上传地址。
- `INGEST_SHARED_SECRET`：Collector 与 API 之间的本地写入密钥。

## 当前验证边界

- 已使用虚构响应测试普通持仓、行情变化、当日买入、费用、资金变化和 27 列字段契约。
- 已用真实登录会话验证 Web 当前版本仍使用表单 POST 和相同接口族；关闭登录窗口后，无界面采集成功读取两个股票账户。
- 真实响应中 22 个有值字段均可生成；5 个官方导出本身留空的字段保持 `null`。`回本涨幅` 只在亏损持仓出现，因此覆盖状态可能是 `partial`，属于产品规则而非接口缺失。
- 现有样本导出与当前页面不是同一账户状态：导出有 10 只，当前目标页面有 1 只，且重合持仓的单位成本也不同，因此不能作为逐值一致性的最终证据。需要对同一账户重新导出后立即运行 `reconcile`。
- 港股盘中市值需要实际响应确认汇率口径；未确认前不会用猜测汇率重算。
- 清仓列表和完整交易历史尚未进入每日快照链路。
