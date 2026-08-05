import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  IndustryMarketBar,
  IndustryMembership,
  IndustryProvider,
  SecurityReference,
} from "./industry.js";

export const EASTMONEY_INDUSTRY_TAXONOMY = "EASTMONEY";
export const EASTMONEY_INDUSTRY_SOURCE = "eastmoney";

const eastmoneyQuoteResponseSchema = z.object({
  rc: z.number(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

const eastmoneyDataResponseSchema = z.object({
  success: z.boolean().optional(),
  result: z
    .object({
      data: z.array(z.record(z.string(), z.unknown())),
    })
    .nullable()
    .optional(),
});

const eastmoneySearchResponseSchema = z.object({
  QuotationCodeTable: z.object({
    Data: z.array(z.record(z.string(), z.unknown())),
  }),
});

type FetchImplementation = typeof globalThis.fetch;

interface EastmoneyIndustryProviderOptions {
  searchApiUrl?: string;
  stockInfoApiUrl?: string;
  historyApiUrl?: string;
  dataApiUrl?: string;
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
  concurrency?: number;
  now?: () => Date;
}

interface IndustryBoard {
  code: string;
  name: string;
}

interface EtfTheme {
  industryName: string;
  boardNames: readonly string[];
}

const eastmoneySearchToken = "D43BF722C8E33BDC906FB84D85E326E8";

const etfThemeRules: ReadonlyArray<{
  pattern: RegExp;
  theme: EtfTheme;
}> = [
  {
    pattern: /半导材料/,
    theme: {
      industryName: "半导体材料",
      boardNames: ["半导体材料", "半导体"],
    },
  },
  {
    pattern: /半导体|芯片|集成电路/,
    theme: { industryName: "半导体", boardNames: ["半导体"] },
  },
  {
    pattern: /创新药/,
    theme: { industryName: "创新药", boardNames: ["创新药", "化学制药"] },
  },
  {
    pattern: /医药|医疗/,
    theme: { industryName: "医药生物", boardNames: ["医药商业", "医疗服务"] },
  },
  {
    pattern: /证券|券商/,
    theme: { industryName: "证券", boardNames: ["证券"] },
  },
  {
    pattern: /银行/,
    theme: { industryName: "银行", boardNames: ["银行"] },
  },
  {
    pattern: /新能源|光伏|风电/,
    theme: {
      industryName: "新能源",
      boardNames: ["新能源", "光伏设备", "风电设备"],
    },
  },
  {
    pattern: /消费/,
    theme: { industryName: "消费", boardNames: ["消费电子", "食品饮料"] },
  },
  {
    pattern: /通信/,
    theme: { industryName: "通信", boardNames: ["通信设备", "通信服务"] },
  },
  {
    pattern: /互联网|互联|中概/,
    theme: { industryName: "互联网服务", boardNames: ["互联网服务"] },
  },
  {
    pattern: /卫星|航天/,
    theme: { industryName: "航天航空", boardNames: ["航天航空"] },
  },
  {
    pattern: /科创|创业/,
    theme: { industryName: "科技成长", boardNames: [] },
  },
];

function stableHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableId(parts: readonly string[]) {
  return stableHash(parts.join(":"));
}

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : null;
}

function apiDate(value: string) {
  return value.replaceAll("-", "");
}

function values(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function isChinaSecurity(reference: SecurityReference) {
  return ["SH", "SZ", "BJ"].includes(reference.market);
}

function isFund(reference: SecurityReference) {
  return (
    (reference.market === "SH" && /^5\d{5}$/.test(reference.symbol)) ||
    (reference.market === "SZ" && /^1[56]\d{4}$/.test(reference.symbol))
  );
}

function etfTheme(reference: SecurityReference): EtfTheme {
  const name = reference.name?.trim() ?? "";
  return (
    etfThemeRules.find((rule) => rule.pattern.test(name))?.theme ?? {
      industryName: "指数基金",
      boardNames: [],
    }
  );
}

function marketCode(reference: SecurityReference) {
  return reference.market === "SH" ? "1" : "0";
}

async function mapWithConcurrency<T, R>(
  entries: readonly T[],
  concurrency: number,
  worker: (entry: T) => Promise<R>,
) {
  const results = new Array<R>(entries.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), entries.length) },
    async () => {
      while (cursor < entries.length) {
        const index = cursor;
        cursor += 1;
        const entry = entries[index];
        if (entry !== undefined) results[index] = await worker(entry);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

export class EastmoneyIndustryProvider implements IndustryProvider {
  readonly taxonomy = EASTMONEY_INDUSTRY_TAXONOMY;
  readonly source = EASTMONEY_INDUSTRY_SOURCE;
  private readonly searchApiUrl: string;
  private readonly stockInfoApiUrl: string;
  private readonly historyApiUrl: string;
  private readonly dataApiUrl: string;
  private readonly fetchImplementation: FetchImplementation;
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly now: () => Date;
  private readonly boardSearches = new Map<
    string,
    Promise<IndustryBoard | null>
  >();

  constructor(options: EastmoneyIndustryProviderOptions = {}) {
    this.searchApiUrl =
      options.searchApiUrl ??
      "https://searchapi.eastmoney.com/api/suggest/get";
    this.stockInfoApiUrl =
      options.stockInfoApiUrl ??
      "https://push2.eastmoney.com/api/qt/stock/get";
    this.historyApiUrl =
      options.historyApiUrl ??
      "https://push2his.eastmoney.com/api/qt/stock/kline/get";
    this.dataApiUrl =
      options.dataApiUrl ??
      "https://datacenter.eastmoney.com/securities/api/data/v1/get";
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.concurrency = options.concurrency ?? 4;
    this.now = options.now ?? (() => new Date());
  }

  async fetchMemberships(securities: readonly SecurityReference[]) {
    const memberships = await mapWithConcurrency(
      securities,
      this.concurrency,
      async (security) => {
        if (isFund(security)) {
          return this.etfMembership(security);
        }
        if (isChinaSecurity(security)) {
          return this.chinaMembership(security);
        }
        if (security.market === "HK") {
          return this.hkMembership(security);
        }
        return null;
      },
    );
    return memberships.filter(
      (membership): membership is IndustryMembership => membership !== null,
    );
  }

  async fetchDailyBars(
    industryCodes: readonly string[],
    startDate: string,
    endDate: string,
  ) {
    const boardCodes = industryCodes.filter((code) => /^BK\d+$/.test(code));
    const batches = await mapWithConcurrency(
      boardCodes,
      this.concurrency,
      async (industryCode) => {
        const payload = await this.getQuote(
          this.historyApiUrl,
          {
            secid: `90.${industryCode}`,
            fields1: "f1,f2,f3,f4,f5,f6",
            fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            klt: "101",
            fqt: "0",
            beg: apiDate(startDate),
            end: apiDate(endDate),
            smplmt: "10000",
            lmt: "1000000",
          },
          `行业行情 ${industryCode}`,
        );
        const industryName = text(payload.data?.name) ?? industryCode;
        const fetchedAt = this.now().toISOString();
        return values(payload.data?.klines).flatMap(
          (raw): IndustryMarketBar[] => {
            if (typeof raw !== "string") return [];
            const columns = raw.split(",");
            const tradeDate = isoDate(columns[0] ?? "");
            if (!tradeDate) return [];
            return [
              {
                id: stableId([this.taxonomy, industryCode, tradeDate]),
                taxonomy: this.taxonomy,
                industryCode,
                industryName,
                tradeDate,
                close: number(columns[2]),
                pctChange: number(columns[8]),
                source: "eastmoney:industry_kline",
                fetchedAt,
              },
            ];
          },
        );
      },
    );
    return batches.flat();
  }

  private async chinaMembership(security: SecurityReference) {
    const payload = await this.getQuote(
      this.stockInfoApiUrl,
      {
        fltt: "2",
        invt: "2",
        fields: "f57,f58,f127",
        secid: `${marketCode(security)}.${security.symbol}`,
      },
      `股票资料 ${security.symbol}`,
    );
    const industryName = text(payload.data?.f127);
    if (!industryName) return null;
    const board = await this.resolveIndustryBoard([industryName]);
    return this.membership({
      security,
      industryCode: board?.code ?? `EM:${stableHash(industryName).slice(0, 12)}`,
      industryName,
      source: "eastmoney:stock_info",
    });
  }

  private async hkMembership(security: SecurityReference) {
    const payload = await this.getData(
      {
        reportName: "RPT_HKF10_INFO_ORGPROFILE",
        columns: "SECUCODE,SECURITY_CODE,ORG_NAME,BELONG_INDUSTRY",
        quoteColumns: "",
        filter: `(SECUCODE=\"${security.symbol}.HK\")`,
        pageNumber: "1",
        pageSize: "10",
        sortTypes: "",
        sortColumns: "",
        source: "F10",
        client: "PC",
      },
      `港股资料 ${security.symbol}`,
    );
    const industryName = text(payload.result?.data[0]?.BELONG_INDUSTRY);
    if (!industryName) return null;
    return this.membership({
      security,
      industryCode: `HK:${stableHash(industryName).slice(0, 12)}`,
      industryName,
      source: "eastmoney:hk_company_profile",
    });
  }

  private async etfMembership(security: SecurityReference) {
    const fundName = security.name?.trim() ?? "";
    const normalizedFundName = fundName
      .replace(/^HK/i, "")
      .replace(/ETF$/i, "")
      .trim();
    const theme = etfTheme(security);
    const board = await this.resolveIndustryBoard([
      fundName,
      normalizedFundName,
      ...theme.boardNames,
    ]);
    const industryName =
      board && [fundName, normalizedFundName].includes(board.name)
        ? board.name
        : theme.industryName;
    return this.membership({
      security,
      industryCode:
        board?.code ?? `ETF:${stableHash(industryName).slice(0, 12)}`,
      industryName,
      relatedSector: `${security.name ?? industryName}（指数基金）`,
      source: "local:etf_name_rule",
    });
  }

  private async resolveIndustryBoard(names: readonly string[]) {
    for (const name of [...new Set(names.map((value) => value.trim()))]) {
      if (!name) continue;
      const board = await this.searchIndustryBoard(name);
      if (board) return board;
    }
    return null;
  }

  private async searchIndustryBoard(name: string) {
    const cached = this.boardSearches.get(name);
    if (cached) return cached;
    const pending = this.fetchIndustryBoardSearch(name);
    this.boardSearches.set(name, pending);
    try {
      return await pending;
    } catch (error) {
      this.boardSearches.delete(name);
      throw error;
    }
  }

  private async fetchIndustryBoardSearch(name: string) {
    const response = await this.request(
      this.searchApiUrl,
      {
        input: name,
        type: "14",
        count: "20",
        token: eastmoneySearchToken,
      },
      `行业搜索 ${name}`,
    );
    const parsed = eastmoneySearchResponseSchema.parse(await response.json());
    for (const record of parsed.QuotationCodeTable.Data) {
      const code = text(record.Code);
      const resultName = text(record.Name);
      const market = text(record.MktNum);
      if (code?.startsWith("BK") && resultName === name && market === "90") {
        return { code, name: resultName };
      }
    }
    return null;
  }

  private membership(input: {
    security: SecurityReference;
    industryCode: string;
    industryName: string;
    relatedSector?: string;
    source: string;
  }): IndustryMembership {
    const fetchedAt = this.now().toISOString();
    return {
      id: stableId([
        this.taxonomy,
        input.security.market,
        input.security.symbol,
        input.industryCode,
      ]),
      taxonomy: this.taxonomy,
      market: input.security.market,
      symbol: input.security.symbol,
      level1Code: input.industryCode,
      level1Name: input.industryName,
      level2Code: input.relatedSector ? `${input.industryCode}:FUND` : null,
      level2Name: input.relatedSector ?? null,
      level3Code: null,
      level3Name: null,
      effectiveFrom: null,
      effectiveTo: null,
      isCurrent: true,
      source: input.source,
      fetchedAt,
    };
  }

  private async getQuote(
    endpoint: string,
    params: Record<string, string>,
    label: string,
  ) {
    const response = await this.request(endpoint, params, label);
    const parsed = eastmoneyQuoteResponseSchema.parse(await response.json());
    if (parsed.rc !== 0 || !parsed.data) {
      throw new Error(`东方财富${label}请求失败：rc ${parsed.rc}`);
    }
    return parsed;
  }

  private async getData(params: Record<string, string>, label: string) {
    const response = await this.request(this.dataApiUrl, params, label);
    const parsed = eastmoneyDataResponseSchema.parse(await response.json());
    if (parsed.success === false || !parsed.result) {
      throw new Error(`东方财富${label}请求失败`);
    }
    return parsed;
  }

  private async request(
    endpoint: string,
    params: Record<string, string>,
    label: string,
  ) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams(params).toString();
    const response = await this.fetchImplementation(url, {
      headers: {
        Accept: "application/json",
        Referer: "https://quote.eastmoney.com/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`东方财富${label}请求失败：HTTP ${response.status}`);
    }
    return response;
  }
}
