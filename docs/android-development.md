# Android 原生开发环境

本文以 macOS 为主，工程位于 `apps/android`。项目固定使用 AGP 9.3.1、Gradle 9.5、Kotlin 2.3.21、JDK 17，并以 Android API 37 编译。

## 1. 安装 Android Studio

从 Android Developers 下载最新稳定版 Android Studio。macOS 选择与处理器对应的安装包：Apple Silicon 选择 ARM，Intel Mac 选择 Intel。拖入 `Applications` 后完成首次启动向导。

当前这台开发机检查结果是：存在 Homebrew 安装的 `adb`，但没有 Android Studio、完整 Android SDK 或可用 JDK。因此必须先完成本节和下一节，Gradle 构建才能运行。

## 2. 安装 SDK 与模拟器

打开 Android Studio 的 **Settings > Languages & Frameworks > Android SDK**：

1. SDK Platforms 安装 **Android API 37**。
2. SDK Tools 安装 **Android SDK Build-Tools 36.0.0**、Platform-Tools、Command-line Tools、Android Emulator。
3. 在 **Device Manager** 新建一台 Phone。Apple Silicon 选择 ARM64 system image；Intel Mac 选择 x86_64。
4. 启动模拟器并用 `adb devices` 确认设备状态为 `device`。

Android Studio 自带 JetBrains Runtime。进入 **Settings > Build, Execution, Deployment > Build Tools > Gradle**，Gradle JDK 选择内置的 JBR 17 或 `GRADLE_LOCAL_JAVA_HOME`，无需另外在系统里安装 Java。

## 3. 打开和同步工程

在 Android Studio 选择 **Open**，打开仓库内的 `apps/android`，不要打开整个 pnpm 根目录。首次 Gradle Sync 会下载 Compose、Room 等依赖。

命令行确认：

```bash
cd apps/android
./gradlew --version
./gradlew testDebugUnitTest lintDebug assembleDebug
```

也可以从仓库根目录运行：

```bash
pnpm android:test
pnpm android:lint
pnpm android:assemble
```

## 4. 启动后端并联调

先准备 Node.js 22+、pnpm 11.9 和 Docker Desktop：

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:deploy
pnpm dev
```

API 默认只监听 Mac 的回环地址。使用 ADB 反向端口转发，在不暴露局域网端口的情况下连接模拟器或 USB 真机：

```bash
pnpm android:reverse
```

Debug 默认 API 地址已配置为：

```text
http://127.0.0.1:4000
```

如需覆盖地址：

```bash
cd apps/android
./gradlew installDebug -PPORTFOLIO_API_BASE_URL=http://127.0.0.1:4000
```

每次模拟器或 USB 连接重新建立后都需要再执行一次 `pnpm android:reverse`。请求成功时客户端更新 Room 缓存；后端暂时不可用时展示最近一次缓存并明确标注来源。没有远端数据和缓存时直接显示错误，不会用演示数据冒充真实持仓。

## 5. 真机调试

1. 手机开启开发者选项与 USB 调试，连接后执行 `adb devices`。
2. 执行 `pnpm android:reverse`，把手机的 `127.0.0.1:4000` 安全转发到 Mac 后端。
3. 安装 Debug 包：

```bash
cd apps/android
./gradlew installDebug
```

这种方式不要求手机和 Mac 在同一 Wi-Fi，也不需要把未鉴权 API 暴露到局域网。断开 USB 后应用仍可读取最近一次 Room 缓存，但无法刷新后端数据。

## 6. 安全和发布

- Debug 构建允许 HTTP，便于本机联调；Release 默认连接 `https://60.205.90.12/maomao-api`，使用受信任的 IP 证书。
- Android 只保存手机号验证码登录后取得的随机会话令牌，并使用 Android Keystore 的 AES-GCM 密钥加密落盘；不再把全局访问密钥编译进 APK，退出或令牌过期时会清理对应本地缓存。
- 不要把模型 API Key、数据库密码、Collector Secret 或券商凭证写入 `BuildConfig`、资源文件或 APK。
- 发布前还需要补齐设备绑定、生物识别门禁、证书策略、签名配置和数据删除流程。
- 第一阶段保持只读；任何未来交易动作都必须由服务端授权，并在 Android 端进行二次确认。

## 常见问题

- `Unable to locate a Java Runtime`：从 Android Studio 内运行，或把 Gradle JDK 指向内置 JBR 17。
- `SDK location not found`：在 Android Studio 完成 SDK 安装；IDE 会生成未提交的 `local.properties`。
- 模拟器或真机无法访问 `localhost:4000`：执行 `pnpm android:reverse`，再点击应用中的“重试”。
- `adb reverse` 提示没有设备：先启动模拟器，或确认 USB 真机已授权调试。
