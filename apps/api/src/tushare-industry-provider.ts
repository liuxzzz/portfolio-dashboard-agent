import { createHash } from "node:crypto";
import { z } from "zod";
import {
  INDUSTRY_SOURCE,
  INDUSTRY_TAXONOMY,
  type IndustryMarketBar,
  type IndustryMembership,
  type IndustryProvider,
  type SecurityReference,
} from "./industry.js";

const tushareResponseSchema = z.object({
  code: z.number(),
  msg: z.string().nullable().optional(),
  data: z
    .object({
      fields: z.array(z.string()),
      items: z.array(z.array(z.unknown())),
    })
    .nullable()
    .optional(),
});

type FetchImplementation = typeof globalThis.fetch;

interface TushareIndustryProviderOptions {
  apiUrl?: string;
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
  concurrency?: number;
  now?: () => Date;
}

function stableId(parts: readonly (string | null)[]) {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex");
}

function tushareCode(reference: SecurityReference) {
  if (reference.symbol.includes(".")) return reference.symbol;
  return `${reference.symbol}.${reference.market}`;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`;
}

function apiDate(value: string) {
  return value.replaceAll("-", "");
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        const value = values[index];
        if (value !== undefined) results[index] = await worker(value);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

export class TushareIndustryProvider implements IndustryProvider {
  readonly taxonomy = INDUSTRY_TAXONOMY;
  readonly source = INDUSTRY_SOURCE;
  private readonly apiUrl: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly now: () => Date;

  constructor(
    private readonly token: string,
    options: TushareIndustryProviderOptions = {},
  ) {
    if (!token.trim()) throw new Error("Tushare token 不能为空");
    this.apiUrl = options.apiUrl ?? "https://api.tushare.pro";
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.concurrency = options.concurrency ?? 4;
    this.now = options.now ?? (() => new Date());
  }

  async fetchMemberships(securities: readonly SecurityReference[]) {
    const batches = await mapWithConcurrency(
      securities,
      this.concurrency,
      async (security) => {
        const rows = await this.query("index_member_all", {
          ts_code: tushareCode(security),
        });
        const fetchedAt = this.now().toISOString();
        return rows.flatMap((row): IndustryMembership[] => {
          const level1Code = text(row.l1_code);
          const level1Name = text(row.l1_name);
          if (!level1Code || !level1Name) return [];
          const level2Code = text(row.l2_code);
          const level2Name = text(row.l2_name);
          const level3Code = text(row.l3_code);
          const level3Name = text(row.l3_name);
          const effectiveFrom = isoDate(row.in_date);
          const effectiveTo = isoDate(row.out_date);
          return [
            {
              id: stableId([
                INDUSTRY_TAXONOMY,
                security.market,
                security.symbol,
                level1Code,
                level2Code,
                level3Code,
                effectiveFrom,
              ]),
              taxonomy: INDUSTRY_TAXONOMY,
              market: security.market,
              symbol: security.symbol,
              level1Code,
              level1Name,
              level2Code,
              level2Name,
              level3Code,
              level3Name,
              effectiveFrom,
              effectiveTo,
              isCurrent: text(row.is_new) === "Y",
              source: "tushare:index_member_all",
              fetchedAt,
            },
          ];
        });
      },
    );
    return batches.flat();
  }

  async fetchDailyBars(
    industryCodes: readonly string[],
    startDate: string,
    endDate: string,
  ) {
    const batches = await mapWithConcurrency(
      industryCodes,
      this.concurrency,
      async (industryCode) => {
        const rows = await this.query("sw_daily", {
          ts_code: industryCode,
          start_date: apiDate(startDate),
          end_date: apiDate(endDate),
        });
        const fetchedAt = this.now().toISOString();
        return rows.flatMap((row): IndustryMarketBar[] => {
          const tradeDate = isoDate(row.trade_date);
          if (!tradeDate) return [];
          const industryName = text(row.name) ?? industryCode;
          return [
            {
              id: stableId([INDUSTRY_TAXONOMY, industryCode, tradeDate]),
              taxonomy: INDUSTRY_TAXONOMY,
              industryCode,
              industryName,
              tradeDate,
              close: number(row.close),
              pctChange: number(row.pct_change),
              source: "tushare:sw_daily",
              fetchedAt,
            },
          ];
        });
      },
    );
    return batches.flat();
  }

  private async query(apiName: string, params: Record<string, string>) {
    const response = await this.fetchImplementation(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_name: apiName,
        token: this.token,
        params,
        fields: "",
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`Tushare ${apiName} 请求失败：HTTP ${response.status}`);
    }
    const parsed = tushareResponseSchema.parse(await response.json());
    if (parsed.code !== 0 || !parsed.data) {
      throw new Error(
        `Tushare ${apiName} 请求失败：${parsed.msg ?? `code ${parsed.code}`}`,
      );
    }
    return parsed.data.items.map((item) =>
      Object.fromEntries(
        parsed.data?.fields.map((field, index) => [field, item[index]]) ?? [],
      ),
    );
  }
}
