import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import {
  TzzbAuthenticationError,
  type TzzbTransport,
  unwrapApiEnvelope,
} from "./transport.js";
import { buildTzzbForwardUrl } from "./forward-url.js";

export interface PlaywrightTransportOptions {
  baseUrl: string;
  profileDir: string;
  browserChannel: string;
  headless: boolean;
  userId: string | undefined;
}

function isLoginResolutionUrl(url: URL) {
  return (
    url.hash.includes("unlogin") ||
    /\/myAccount\/a\//.test(url.hash)
  );
}

async function waitForLoginResolution(page: Page) {
  await page
    .waitForURL((url) => isLoginResolutionUrl(url), { timeout: 10_000 })
    .catch(() => undefined);
}

export class PlaywrightTzzbTransport implements TzzbTransport {
  private constructor(
    private readonly context: BrowserContext,
    private readonly options: PlaywrightTransportOptions,
  ) {}

  static async create(options: PlaywrightTransportOptions) {
    const context = await chromium.launchPersistentContext(
      path.resolve(options.profileDir),
      {
        channel: options.browserChannel,
        headless: options.headless,
      },
    );
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${options.baseUrl}/pc/index.html#/myAccount`, {
      waitUntil: "domcontentloaded",
    });
    await waitForLoginResolution(page);
    if (new URL(page.url()).hash.includes("unlogin")) {
      await context.close();
      throw new TzzbAuthenticationError();
    }
    return new PlaywrightTzzbTransport(context, options);
  }

  async post(pathname: string, params: Record<string, string>) {
    const identity = this.options.userId
      ? { userid: this.options.userId, user_id: this.options.userId }
      : {};
    const response = await this.context.request.post(
      buildTzzbForwardUrl(this.options.baseUrl, pathname),
      {
        form: {
          terminal: "1",
          version: "0.0.0",
          ...identity,
          ...params,
        },
        headers: { Accept: "application/json" },
      },
    );
    if (response.status() === 401 || response.status() === 403) {
      throw new TzzbAuthenticationError();
    }
    if (!response.ok()) {
      throw new Error(`同花顺接口返回 HTTP ${response.status()}`);
    }
    return unwrapApiEnvelope(await response.json());
  }

  async close() {
    await this.context.close();
  }
}

export async function openInteractiveLogin(options: PlaywrightTransportOptions) {
  const context = await chromium.launchPersistentContext(
    path.resolve(options.profileDir),
    { channel: options.browserChannel, headless: false },
  );
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${options.baseUrl}/pc/index.html#/myAccount`, {
    waitUntil: "domcontentloaded",
  });
  await waitForLoginResolution(page);
  if (new URL(page.url()).hash.includes("unlogin")) {
    console.log("请在打开的浏览器中完成同花顺登录；登录成功后窗口会自动关闭。 ");
    await page.waitForURL(
      (url) =>
        url.hash.includes("myAccount") && !url.hash.includes("unlogin"),
      { timeout: 10 * 60_000 },
    );
  }
  await context.close();
  console.log("本地登录会话已准备好。Cookie 仅保存在本机隔离资料目录中。 ");
}
