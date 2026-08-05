import type { PortfolioSnapshot } from "@portfolio/domain";
import { accountRequestParams, parseStockAccounts, type TzzbAccount } from "./accounts.js";
import { normalizeSnapshot, type RateUnit } from "./normalize.js";
import {
  bankHistoryResponseSchema,
  mergeTradesResponseSchema,
  quotesResponseSchema,
  stockPositionResponseSchema,
} from "./schemas.js";
import type { TzzbTransport } from "./transport.js";

const endpoints = {
  accounts: "/caishen_fund/pc/account/v1/account_list",
  positions: "/caishen_fund/pc/asset/v1/stock_position",
  trades: "/caishen_fund/pc/account/v1/merge_day_trading",
  transfers: "/caishen_fund/pc/asset/v1/query_bank_history",
  quotes: "/caishen_fund/invest/v1/pass_quotes",
} as const;

export interface CollectOptions {
  capturedAt?: Date;
  rateUnit?: RateUnit | undefined;
  accountIds?: string[] | undefined;
}

export class TzzbClient {
  constructor(private readonly transport: TzzbTransport) {}

  async listAccounts() {
    return parseStockAccounts(await this.transport.post(endpoints.accounts, {}));
  }

  async collectAccount(
    account: TzzbAccount,
    options: CollectOptions = {},
  ): Promise<PortfolioSnapshot> {
    const params = accountRequestParams(account);
    const positionResponse = stockPositionResponseSchema.parse(
      await this.transport.post(endpoints.positions, {
        ...params,
        is_merge: "0",
      }),
    );
    const [tradeResponse, transferResponse] = await Promise.all([
      this.transport
        .post(endpoints.trades, params)
        .then((payload) => mergeTradesResponseSchema.parse(payload)),
      this.transport
        .post(endpoints.transfers, params)
        .then((payload) => bankHistoryResponseSchema.parse(payload)),
    ]);
    const quoteCodes = positionResponse.position
      .map((position) => `${String(position.market ?? "")}:${String(position.code ?? "")}`)
      .filter((code) => code !== ":")
      .join(",");
    const quotes = quoteCodes
      ? quotesResponseSchema.parse(
          await this.transport.post(endpoints.quotes, { code: quoteCodes }),
        )
      : [];

    return normalizeSnapshot({
      account,
      positionResponse,
      trades: tradeResponse.data,
      transfers: transferResponse.stock,
      quotes,
      capturedAt: options.capturedAt ?? new Date(),
      rateUnit: options.rateUnit,
    });
  }

  async collect(options: CollectOptions = {}) {
    const accounts = await this.listAccounts();
    const selected = options.accountIds?.length
      ? accounts.filter((account) =>
          options.accountIds?.includes(account.sourceAccountId),
        )
      : accounts;

    if (selected.length === 0) {
      throw new Error(
        options.accountIds?.length
          ? "没有找到配置中指定的股票账户"
          : "当前登录用户没有可采集的股票账户",
      );
    }

    const snapshots: PortfolioSnapshot[] = [];
    for (const account of selected) {
      snapshots.push(await this.collectAccount(account, options));
    }
    return snapshots;
  }

  async close() {
    await this.transport.close();
  }
}

export { endpoints as tzzbEndpoints };
