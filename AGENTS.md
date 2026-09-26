# Portfolio Agent 开发约定

## 产品与服务边界

- `apps/web` 是主要产品入口；`apps/android` 是便捷客户端。两端使用 `apps/api` 的同一组 `/v1` 接口和同一用户账户。
- Agent 结论、证据和 Run 来自服务端。前端不伪造分析结果，不把确定性规则描述成模型推理。
- 跨端数据字段以 `packages/domain` 为准。改动 API 合约时同步更新契约、两端调用和 `docs/api.md`。
- 密钥、采集器会话和券商凭证只留在服务端或本地采集器，不进入 Web 构建产物和 Android APK。

## Web 架构（FSD）

- 使用 React、TypeScript、Tailwind CSS 和 `shared/ui` 下的 shadcn/ui 组件；组件配置见 `apps/web/components.json`。
- 依赖方向：`app → pages → widgets → features → entities → shared`。同层模块不要相互依赖；页面可组合 widgets、features、entities 和 shared。`shared` 不导入上层。
- `app` 放应用装配与路由；`pages` 放页面；`widgets` 放跨页面布局；`features` 放用户动作；`entities` 放组合、Agent 等领域展示和状态；`shared/api` 放 HTTP 与契约校验，`shared/ui` 放基础组件。
- 领域模型复用 `@portfolio/domain`，不要在组件里重写后端字段结构。API 响应用 Zod 校验；错误态、空态、加载态均应可见。
- 金额默认隐藏；新增金额字段时必须经过统一的 `money(value, visible)` 展示函数。交互元素要有语义标签，桌面与窄屏均需可用。

## AI 辅助开发验证

- 修改前查看当前工作树，保留无关改动；不要提交实际账户数据、令牌、Cookie 或 XLSX。
- 完成 Web 功能后运行 `pnpm typecheck`、`pnpm test`、`pnpm build`。涉及真实登录、导入或行业标签写入时，分别说明代码检查与真实 API 验收的范围。
- 不因测试夹具、演示数据或浏览器静态画面宣称真实账户链路已经通过。
