import { createHash } from "node:crypto";
import type {
  IndustryAllocation,
  IndustryDataStatus,
  PortfolioSnapshot,
} from "@portfolio/domain";
import type { PortfolioRepository } from "./repository.js";

export const INDUSTRY_TAXONOMY = "SW2021";
export const INDUSTRY_SOURCE = "tushare";

export interface SecurityReference {
  market: string;
  symbol: string;
  name?: string;
}

export interface IndustryMembership extends SecurityReference {
  id: string;
  taxonomy: string;
  level1Code: string;
  level1Name: string;
  level2Code: string | null;
  level2Name: string | null;
  level3Code: string | null;
  level3Name: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isCurrent: boolean;
  source: string;
  fetchedAt: string;
}

export interface IndustryMarketBar {
  id: string;
  taxonomy: string;
  industryCode: string;
  industryName: string;
  tradeDate: string;
  close: number | null;
  pctChange: number | null;
  source: string;
  fetchedAt: string;
}

export interface IndustryProvider {
  readonly taxonomy: string;
  readonly source: string;
  fetchMemberships(
    securities: readonly SecurityReference[],
  ): Promise<IndustryMembership[]>;
  fetchDailyBars(
    industryCodes: readonly string[],
    startDate: string,
    endDate: string,
  ): Promise<IndustryMarketBar[]>;
}

export interface IndustryEnrichment {
  snapshot: PortfolioSnapshot;
  industries: IndustryAllocation[];
  industryData: IndustryDataStatus;
}

const industryColors = [
  "#172033",
  "#5BC5A7",
  "#F3B45A",
  "#7C8BE8",
  "#D96C8B",
  "#8B98A9",
];

function securityKey(reference: SecurityReference) {
  return `${reference.market}:${reference.symbol}`;
}

function uniqueSecurityReferences(snapshot: PortfolioSnapshot) {
  const unique = new Map<string, SecurityReference>();
  for (const position of snapshot.positions) {
    if (!["SH", "SZ", "BJ", "HK"].includes(position.market)) continue;
    const reference = {
      market: position.market,
      symbol: position.symbol,
      name: position.name,
    };
    unique.set(securityKey(reference), reference);
  }
  return [...unique.values()];
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function dateDaysBefore(value: Date, days: number) {
  return isoDate(new Date(value.getTime() - days * 24 * 60 * 60 * 1_000));
}

function aggregateIndustries(
  snapshot: PortfolioSnapshot,
  membershipBySecurity: ReadonlyMap<string, IndustryMembership>,
  barByCode: ReadonlyMap<string, IndustryMarketBar>,
): IndustryAllocation[] {
  const totals = new Map<
    string,
    {
      code: string | null;
      name: string;
      value: number;
      dayRate: number | null;
      hasMarketBar: boolean;
    }
  >();

  for (const position of snapshot.positions) {
    const membership = membershipBySecurity.get(securityKey(position));
    const name = position.industry ?? "未分类";
    const code = membership?.level1Code ?? null;
    const bar = code ? barByCode.get(code) : undefined;
    const key = `name:${name}`;
    const dayRate =
      bar?.pctChange === null || bar?.pctChange === undefined
        ? position.sectorRate ?? null
        : bar.pctChange / 100;
    const existing = totals.get(key);
    if (existing) {
      existing.value += position.marketValue;
      if (!existing.hasMarketBar && bar) {
        existing.code = code;
        existing.dayRate = dayRate;
        existing.hasMarketBar = true;
      } else if (existing.dayRate === null && dayRate !== null) {
        existing.dayRate = dayRate;
      }
      continue;
    }
    totals.set(key, {
      code,
      name,
      value: position.marketValue,
      dayRate,
      hasMarketBar: bar !== undefined,
    });
  }

  return [...totals.values()]
    .sort((left, right) => right.value - left.value)
    .map((industry, index) => ({
      name: industry.name,
      code: industry.code,
      value: industry.value,
      weight: snapshot.totalAsset === 0 ? 0 : industry.value / snapshot.totalAsset,
      dayRate: industry.dayRate,
      color: industryColors[index % industryColors.length] ?? "#8B98A9",
    }));
}

function refreshKey(values: readonly string[]) {
  return createHash("sha256").update([...values].sort().join(",")).digest("hex");
}

export class PortfolioIndustryService {
  private readonly membershipAttempts = new Map<string, number>();
  private readonly barAttempts = new Map<string, number>();
  private readonly membershipFailures = new Set<string>();
  private readonly barFailures = new Set<string>();

  constructor(
    private readonly repository: PortfolioRepository,
    private readonly provider?: IndustryProvider,
    private readonly now: () => Date = () => new Date(),
    private readonly membershipRefreshMs = 24 * 60 * 60 * 1_000,
    private readonly barRefreshMs = 15 * 60 * 1_000,
  ) {}

  async enrich(
    snapshot: PortfolioSnapshot,
    options: { force?: boolean } = {},
  ): Promise<IndustryEnrichment> {
    const securities = uniqueSecurityReferences(snapshot);
    const asOf = new Date(snapshot.capturedAt);
    const taxonomy = this.provider?.taxonomy ?? INDUSTRY_TAXONOMY;
    const source = this.provider?.source ?? INDUSTRY_SOURCE;
    let syncFailed = false;
    let syncAttempted = false;

    if (this.provider && securities.length > 0) {
      const key = refreshKey(securities.map(securityKey));
      const refreshMs = this.membershipFailures.has(key)
        ? this.barRefreshMs
        : this.membershipRefreshMs;
      if (this.shouldRefresh(this.membershipAttempts, key, refreshMs, options.force)) {
        syncAttempted = true;
        try {
          const memberships = await this.provider.fetchMemberships(securities);
          await this.repository.saveIndustryMemberships(memberships);
          this.membershipFailures.delete(key);
        } catch {
          this.membershipFailures.add(key);
        }
      }
      if (this.membershipFailures.has(key)) syncFailed = true;
    }

    const memberships = await this.repository.getIndustryMemberships(
      securities,
      asOf,
      taxonomy,
    );
    const membershipBySecurity = new Map(
      memberships.map((membership) => [securityKey(membership), membership]),
    );
    const industryCodes = [
      ...new Set(memberships.map((membership) => membership.level1Code)),
    ];

    if (this.provider && industryCodes.length > 0) {
      const key = refreshKey(industryCodes);
      if (this.shouldRefresh(this.barAttempts, key, this.barRefreshMs, options.force)) {
        syncAttempted = true;
        try {
          const bars = await this.provider.fetchDailyBars(
            industryCodes,
            dateDaysBefore(asOf, 14),
            isoDate(asOf),
          );
          await this.repository.saveIndustryBars(bars);
          this.barFailures.delete(key);
        } catch {
          this.barFailures.add(key);
        }
      }
      if (this.barFailures.has(key)) syncFailed = true;
    }

    const bars = await this.repository.getLatestIndustryBars(
      industryCodes,
      asOf,
      taxonomy,
    );
    const barByCode = new Map(bars.map((bar) => [bar.industryCode, bar]));
    const enrichedSnapshot: PortfolioSnapshot = {
      ...snapshot,
      positions: snapshot.positions.map((position) => {
        const membership = membershipBySecurity.get(securityKey(position));
        if (!membership) return position;
        const bar = barByCode.get(membership.level1Code);
        return {
          ...position,
          industry: membership.level1Name,
          relatedSector:
            membership.level3Name ??
            membership.level2Name ??
            membership.level1Name,
          sectorRate:
            bar?.pctChange === null || bar?.pctChange === undefined
              ? position.sectorRate ?? null
              : bar.pctChange / 100,
        };
      }),
    };

    const latestFetchedAt = [...memberships, ...bars]
      .map((record) => record.fetchedAt)
      .sort()
      .at(-1) ?? null;
    const hasCachedData = memberships.length > 0;
    const industryData: IndustryDataStatus = this.provider
      ? {
          taxonomy,
          source,
          status: syncFailed
            ? hasCachedData
              ? "stale"
              : "unavailable"
            : "fresh",
          syncedAt: latestFetchedAt,
          message: syncFailed
            ? hasCachedData
              ? "行业数据刷新失败，当前展示最近一次缓存"
              : "行业数据暂时不可用"
            : syncAttempted
              ? null
              : "行业数据来自本地缓存",
        }
      : {
          taxonomy,
          source,
          status: hasCachedData ? "stale" : "disabled",
          syncedAt: latestFetchedAt,
          message: hasCachedData
            ? "未配置行业数据凭证，当前展示最近一次缓存"
            : "行业数据源未启用",
        };

    return {
      snapshot: enrichedSnapshot,
      industries: aggregateIndustries(
        enrichedSnapshot,
        membershipBySecurity,
        barByCode,
      ),
      industryData,
    };
  }

  private shouldRefresh(
    attempts: Map<string, number>,
    key: string,
    refreshMs: number,
    force = false,
  ) {
    const current = this.now().getTime();
    const previous = attempts.get(key);
    if (!force && previous !== undefined && current - previous < refreshMs) {
      return false;
    }
    attempts.set(key, current);
    return true;
  }
}
