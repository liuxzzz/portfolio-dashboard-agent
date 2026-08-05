import { spawn, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ACCOUNT_LIST_PATH = "/caishen_fund/pc/account/v1/account_list";

export interface InteractiveSessionOptions {
  baseUrl: string;
  cdpUrl: string;
  timeoutMs?: number | undefined;
}

export interface InteractiveLoginOptions {
  baseUrl: string;
  profileDir: string;
  chromeExecutable?: string | undefined;
  timeoutMs?: number | undefined;
}

export function extractCapturedUserId(postData: string | null) {
  const params = new URLSearchParams(postData ?? "");
  return params.get("userid") ?? params.get("user_id");
}

async function isExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findOnPath(command: string) {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, command);
    if (await isExecutable(candidate)) return candidate;
  }
  return null;
}

export async function resolveChromeExecutable(override?: string) {
  if (override) {
    const resolved = path.resolve(override);
    if (await isExecutable(resolved)) return resolved;
    throw new Error(`找不到配置的 Chrome：${resolved}`);
  }

  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
        ]
      : process.platform === "win32"
        ? [
            process.env.LOCALAPPDATA
              ? path.join(
                  process.env.LOCALAPPDATA,
                  "Google/Chrome/Application/chrome.exe",
                )
              : "",
            process.env.PROGRAMFILES
              ? path.join(
                  process.env.PROGRAMFILES,
                  "Google/Chrome/Application/chrome.exe",
                )
              : "",
          ]
        : [];
  for (const candidate of candidates) {
    if (candidate && (await isExecutable(candidate))) return candidate;
  }
  for (const command of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ]) {
    const executable = await findOnPath(command);
    if (executable) return executable;
  }
  throw new Error(
    "找不到 Google Chrome；请通过 TZZB_CHROME_EXECUTABLE 配置程序路径",
  );
}

async function reserveLocalPort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("无法分配本地浏览器连接端口");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function waitForChrome(cdpUrl: string, child: ChildProcess) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Chrome 在登录页面打开前意外退出");
    }
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome may need a short moment to start its local debugging endpoint.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("等待 Chrome 登录窗口启动超时");
}

async function stopChrome(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

export async function connectInteractiveTzzbSession(
  options: InteractiveSessionOptions,
) {
  const browser = await chromium.connectOverCDP(options.cdpUrl, {
    noDefaults: true,
    timeout: 15_000,
  });
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("普通 Chrome 没有可连接的浏览器上下文");
    const existingPage = context
      .pages()
      .find((candidate) => candidate.url().startsWith(options.baseUrl));
    const page = existingPage ?? (await context.newPage());
    const authenticatedAccountList = page.waitForResponse(
      async (response) => {
        if (
          !response.url().includes(ACCOUNT_LIST_PATH) ||
          response.status() < 200 ||
          response.status() >= 300 ||
          !extractCapturedUserId(response.request().postData())
        ) {
          return false;
        }
        try {
          const payload = (await response.json()) as Record<string, unknown>;
          return String(payload.error_code) === "0" && payload.ex_data !== undefined;
        } catch {
          return false;
        }
      },
      { timeout: options.timeoutMs ?? 10 * 60_000 },
    );

    if (existingPage) {
      await page.reload({ waitUntil: "domcontentloaded" });
    } else {
      await page.goto(`${options.baseUrl}/pc/index.html#/myAccount`, {
        waitUntil: "domcontentloaded",
      });
    }
    const response = await authenticatedAccountList;
    const userId = extractCapturedUserId(response.request().postData());
    if (!userId) {
      throw new Error("账户请求已成功，但没有捕获到本地用户标识");
    }

    return { browser, context, userId };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function openInteractiveLogin(options: InteractiveLoginOptions) {
  const executable = await resolveChromeExecutable(options.chromeExecutable);
  const port = await reserveLocalPort();
  const cdpUrl = `http://127.0.0.1:${port}`;
  const args = [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.resolve(options.profileDir)}`,
    "--no-first-run",
  ];
  if (process.platform === "darwin") {
    args.push("--password-store=basic", "--use-mock-keychain");
  }
  args.push(`${options.baseUrl}/pc/index.html#/myAccount`);
  const child = spawn(executable, args, { stdio: "ignore" });
  try {
    await waitForChrome(cdpUrl, child);
    console.log(
      "请在打开的 Chrome 中完成同花顺登录；识别成功后窗口会自动关闭。",
    );
    const session = await connectInteractiveTzzbSession({
      baseUrl: options.baseUrl,
      cdpUrl,
      timeoutMs: options.timeoutMs,
    });
    try {
      return { userId: session.userId };
    } finally {
      await session.browser.close();
    }
  } finally {
    await stopChrome(child);
  }
}
