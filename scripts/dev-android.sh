#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log() {
  printf '[dev:android] %s\n' "$*"
}

fail() {
  printf '[dev:android] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "找不到 $1，请先完成开发环境安装。"
}

require_command docker
require_command pnpm
require_command curl

if [[ ! -f .env ]]; then
  fail "缺少 .env。请先执行 cp .env.example .env 并补齐必需配置。"
fi

if [[ ! -d node_modules ]]; then
  log "安装 pnpm 依赖..."
  pnpm install
fi

ANDROID_SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME}/Library/Android/sdk}}"
ADB_BIN="${ANDROID_ADB_BIN:-${ANDROID_SDK_DIR}/platform-tools/adb}"
EMULATOR_BIN="${ANDROID_EMULATOR_BIN:-${ANDROID_SDK_DIR}/emulator/emulator}"

if [[ ! -x "$ADB_BIN" ]]; then
  ADB_BIN="$(command -v adb || true)"
fi
[[ -n "$ADB_BIN" && -x "$ADB_BIN" ]] || fail "找不到 adb，请在 Android Studio 中安装 Platform-Tools。"

API_PID=""
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    log "正在停止 API..."
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
  return "$status"
}
trap cleanup EXIT
trap 'exit 0' INT
trap 'exit 143' TERM

log "启动 PostgreSQL 并等待数据库健康..."
docker compose up -d --wait postgres

log "执行数据库迁移..."
pnpm db:deploy

if curl -fsS --max-time 2 http://127.0.0.1:4000/health >/dev/null 2>&1; then
  log "API 已在 http://127.0.0.1:4000 运行，直接复用。"
else
  log "启动 API..."
  pnpm dev &
  API_PID=$!
fi

"$ADB_BIN" start-server >/dev/null
EMULATOR_SERIAL="$("$ADB_BIN" devices | awk '$1 ~ /^emulator-/ { print $1; exit }')"

if [[ -z "$EMULATOR_SERIAL" ]]; then
  if [[ ! -x "$EMULATOR_BIN" ]]; then
    EMULATOR_BIN="$(command -v emulator || true)"
  fi
  [[ -n "$EMULATOR_BIN" && -x "$EMULATOR_BIN" ]] || fail "找不到 Android Emulator，请在 Android Studio 中安装 Emulator。"

  AVAILABLE_AVDS="$("$EMULATOR_BIN" -list-avds)"
  [[ -n "$AVAILABLE_AVDS" ]] || fail "没有可用模拟器，请先在 Android Studio Device Manager 中创建一个。"

  if [[ -n "${PORTFOLIO_ANDROID_AVD:-}" ]]; then
    AVD_NAME="$PORTFOLIO_ANDROID_AVD"
    printf '%s\n' "$AVAILABLE_AVDS" | grep -Fxq "$AVD_NAME" ||
      fail "找不到模拟器 ${AVD_NAME}。可用模拟器：$(printf '%s' "$AVAILABLE_AVDS" | tr '\n' ' ')"
  elif printf '%s\n' "$AVAILABLE_AVDS" | grep -Fxq 'Pixel_10a'; then
    AVD_NAME='Pixel_10a'
  else
    AVD_NAME="$(printf '%s\n' "$AVAILABLE_AVDS" | sed -n '1p')"
  fi

  EMULATOR_LOG="${TMPDIR:-/tmp}/portfolio-dashboard-agent-emulator.log"
  log "启动模拟器 ${AVD_NAME}（日志：${EMULATOR_LOG}）..."
  if command -v setsid >/dev/null 2>&1; then
    nohup setsid "$EMULATOR_BIN" -avd "$AVD_NAME" \
      -no-metrics \
      -crash-report-mode never \
      >"$EMULATOR_LOG" 2>&1 &
  elif command -v perl >/dev/null 2>&1; then
    nohup perl -MPOSIX=setsid -e \
      'setsid() >= 0 or die "setsid failed: $!"; exec @ARGV or die "exec failed: $!"' \
      "$EMULATOR_BIN" -avd "$AVD_NAME" \
      -no-metrics \
      -crash-report-mode never \
      >"$EMULATOR_LOG" 2>&1 &
  else
    nohup "$EMULATOR_BIN" -avd "$AVD_NAME" \
      -no-metrics \
      -crash-report-mode never \
      >"$EMULATOR_LOG" 2>&1 &
  fi

  for ((attempt = 1; attempt <= 120; attempt++)); do
    EMULATOR_SERIAL="$("$ADB_BIN" devices | awk '$1 ~ /^emulator-/ { print $1; exit }')"
    [[ -n "$EMULATOR_SERIAL" ]] && break
    sleep 1
  done

  if [[ -z "$EMULATOR_SERIAL" ]]; then
    tail -n 20 "$EMULATOR_LOG" >&2 || true
    fail "模拟器在 120 秒内没有连接 adb。"
  fi
else
  log "复用已运行的模拟器 ${EMULATOR_SERIAL}。"
fi

log "等待模拟器 $EMULATOR_SERIAL 完成启动..."
for ((attempt = 1; attempt <= 180; attempt++)); do
  BOOT_COMPLETED="$("$ADB_BIN" -s "$EMULATOR_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$BOOT_COMPLETED" == '1' ]] && break
  sleep 1
done
[[ "${BOOT_COMPLETED:-}" == '1' ]] || fail "模拟器在 180 秒内没有完成启动。"

log "配置 API 端口转发..."
"$ADB_BIN" -s "$EMULATOR_SERIAL" reverse tcp:4000 tcp:4000

log "构建并安装 Debug App..."
ANDROID_SERIAL="$EMULATOR_SERIAL" pnpm android:install

log "等待 API 就绪..."
for ((attempt = 1; attempt <= 60; attempt++)); do
  if curl -fsS --max-time 2 http://127.0.0.1:4000/health >/dev/null 2>&1; then
    break
  fi
  if [[ -n "$API_PID" ]] && ! kill -0 "$API_PID" 2>/dev/null; then
    wait "$API_PID" 2>/dev/null || true
    fail "API 启动失败，请检查上方日志和 .env 配置。"
  fi
  sleep 1
done

curl -fsS --max-time 2 http://127.0.0.1:4000/health >/dev/null 2>&1 ||
  fail "API 在 60 秒内没有就绪。"

log "打开 Portfolio App..."
"$ADB_BIN" -s "$EMULATOR_SERIAL" shell am start \
  -n com.horizon.portfolio/.MainActivity >/dev/null

log "开发环境已就绪：API http://127.0.0.1:4000，设备 ${EMULATOR_SERIAL}。"
if [[ -n "$API_PID" ]]; then
  log "API 正在监听文件变化；按 Ctrl+C 停止 API（数据库和模拟器会保留）。"
  wait "$API_PID"
fi
