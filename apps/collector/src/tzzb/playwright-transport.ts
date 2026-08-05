import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
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

export class PlaywrightTzzbTransport implements TzzbTransport {
  private constructor(
    private readonly context: BrowserContext,
    private readonly options: PlaywrightTransportOptions,
    private readonly closeTransport: () => Promise<void>,
  ) {}

  static async create(options: PlaywrightTransportOptions) {
    const context = await chromium.launchPersistentContext(
      path.resolve(options.profileDir),
      {
        channel: options.browserChannel,
        headless: options.headless,
      },
    );
    return new PlaywrightTzzbTransport(
      context,
      options,
      async () => context.close(),
    );
  }

  static attach(
    context: BrowserContext,
    options: PlaywrightTransportOptions,
    closeTransport: () => Promise<void>,
  ) {
    return new PlaywrightTzzbTransport(context, options, closeTransport);
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
    await this.closeTransport();
  }
}
