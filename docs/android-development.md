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

Android 模拟器把宿主机映射为 `10.0.2.2`，Debug 默认 API 地址已配置为：

```text
http://10.0.2.2:4000
```

如需覆盖地址：

```bash
cd apps/android
./gradlew installDebug -PPORTFOLIO_API_BASE_URL=http://10.0.2.2:4000
```

未启动后端、数据库没有快照或请求失败时，客户端会依次尝试 Room 缓存和虚构演示数据，并在界面上标注来源。

## 5. 真机调试

1. 手机开启开发者选项与 USB 调试，连接后执行 `adb devices`。
2. 在 `.env` 中临时设置 `HOST=0.0.0.0`，让 API 监听局域网；只在可信网络中这样做。
3. 查出 Mac 的局域网地址，例如 `192.168.1.20`。
4. 安装 Debug 包时覆盖 API 地址：

```bash
cd apps/android
./gradlew installDebug -PPORTFOLIO_API_BASE_URL=http://192.168.1.20:4000
```

手机与 Mac 必须在同一网络，macOS 防火墙需要允许 Node 进程入站。结束后把 API 恢复为 `HOST=127.0.0.1`。

## 6. 安全和发布

- Debug 构建允许 HTTP，便于本机联调；Release 构建已经禁止明文流量，生产 API 必须是 HTTPS。
- 不要把模型 API Key、数据库密码、Collector Secret 或券商凭证写入 `BuildConfig`、资源文件或 APK。
- 发布前需要补齐用户登录、短期访问令牌、设备绑定、证书策略、签名配置和数据删除流程。
- 第一阶段保持只读；任何未来交易动作都必须由服务端授权，并在 Android 端进行二次确认。

## 常见问题

- `Unable to locate a Java Runtime`：从 Android Studio 内运行，或把 Gradle JDK 指向内置 JBR 17。
- `SDK location not found`：在 Android Studio 完成 SDK 安装；IDE 会生成未提交的 `local.properties`。
- 模拟器无法访问 `localhost:4000`：Android 模拟器必须使用 `10.0.2.2:4000`。
- 真机请求被拒绝：检查 `HOST=0.0.0.0`、局域网 IP、防火墙和 Debug 构建；不要为 Release 开启明文 HTTP。
