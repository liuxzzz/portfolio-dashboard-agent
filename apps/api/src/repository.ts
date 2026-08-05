import { createHash } from "node:crypto";
import type {
  AgentRun,
  PortfolioHistoryPoint,
  PortfolioSnapshot,
} from "@portfolio/domain";
import type {
  IndustryMarketBar,
  IndustryMembership,
  SecurityReference,
} from "./industry.js";

export type SnapshotSaveResult = "created" | "existing";

export interface PortfolioRepository {
  healthCheck(): Promise<void>;
  saveSnapshot(snapshot: PortfolioSnapshot): Promise<SnapshotSaveResult>;
  saveAgentRun(run: AgentRun): Promise<void>;
  getLatestSnapshot(accountId?: string): Promise<PortfolioSnapshot | null>;
  getLatestAgentRun(snapshotId: string): Promise<AgentRun | null>;
  getHistory(accountId: string, limit: number): Promise<PortfolioHistoryPoint[]>;
  saveIndustryMemberships(
    memberships: readonly IndustryMembership[],
  ): Promise<void>;
  getIndustryMemberships(
    securities: readonly SecurityReference[],
    asOf: Date,
    taxonomy: string,
  ): Promise<IndustryMembership[]>;
  saveIndustryBars(bars: readonly IndustryMarketBar[]): Promise<void>;
  getLatestIndustryBars(
    industryCodes: readonly string[],
    asOf: Date,
    taxonomy: string,
  ): Promise<IndustryMarketBar[]>;
}

export function snapshotContentHash(snapshot: PortfolioSnapshot) {
  const canonical = {
    ...snapshot,
    positions: snapshot.positions
      .map((position) => ({
        ...position,
        latestRate: position.latestRate ?? null,
        relatedSector: position.relatedSector ?? null,
        sectorRate: position.sectorRate ?? null,
        combinationProfit: position.combinationProfit ?? null,
        combinationRate: position.combinationRate ?? null,
        cumulativeProfit: position.cumulativeProfit ?? null,
        cumulativeProfitRate: position.cumulativeProfitRate ?? null,
        weekProfit: position.weekProfit ?? null,
        monthProfit: position.monthProfit ?? null,
        yearProfit: position.yearProfit ?? null,
        breakEvenRate: position.breakEvenRate ?? null,
        oneMonthRate: position.oneMonthRate ?? null,
        threeMonthRate: position.threeMonthRate ?? null,
        sixMonthRate: position.sixMonthRate ?? null,
        oneYearRate: position.oneYearRate ?? null,
      }))
      .sort((left, right) =>
        `${left.market}:${left.symbol}`.localeCompare(
          `${right.market}:${right.symbol}`,
        ),
      ),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export class MemoryPortfolioRepository implements PortfolioRepository {
  private readonly snapshots = new Map<string, PortfolioSnapshot>();
  private readonly runs = new Map<string, AgentRun>();
  private readonly industryMemberships = new Map<string, IndustryMembership>();
  private readonly industryBars = new Map<string, IndustryMarketBar>();

  async healthCheck() {}

  async saveSnapshot(snapshot: PortfolioSnapshot) {
    const existing = this.snapshots.get(snapshot.id);
    if (existing) {
      if (snapshotContentHash(existing) !== snapshotContentHash(snapshot)) {
        throw new Error("同一快照 ID 对应了不同内容，已拒绝覆盖历史数据");
      }
      return "existing" as const;
    }
    this.snapshots.set(snapshot.id, snapshot);
    return "created" as const;
  }

  async saveAgentRun(run: AgentRun) {
    this.runs.set(run.id, run);
  }

  async getLatestSnapshot(accountId?: string) {
    return (
      [...this.snapshots.values()]
        .filter(
          (snapshot) =>
            accountId === undefined || snapshot.sourceAccountId === accountId,
        )
        .sort((left, right) =>
          right.capturedAt.localeCompare(left.capturedAt),
        )[0] ?? null
    );
  }

  async getLatestAgentRun(snapshotId: string) {
    return (
      [...this.runs.values()]
        .filter((run) => run.snapshotId === snapshotId)
        .sort((left, right) =>
          right.requestedAt.localeCompare(left.requestedAt),
        )[0] ?? null
    );
  }

  async getHistory(accountId: string, limit: number) {
    return [...this.snapshots.values()]
      .filter((snapshot) => snapshot.sourceAccountId === accountId)
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
      .slice(-limit)
      .map((snapshot) => ({
        date: snapshot.capturedAt.slice(0, 10),
        totalAsset: snapshot.totalAsset,
        positionRate: snapshot.positionRate,
      }));
  }

  async saveIndustryMemberships(
    memberships: readonly IndustryMembership[],
  ) {
    for (const membership of memberships) {
      this.industryMemberships.set(membership.id, membership);
    }
  }

  async getIndustryMemberships(
    securities: readonly SecurityReference[],
    asOf: Date,
    taxonomy: string,
  ) {
    const date = asOf.toISOString();
    const requested = new Set(
      securities.map((security) => `${security.market}:${security.symbol}`),
    );
    const candidates = [...this.industryMemberships.values()]
      .filter(
        (membership) =>
          membership.taxonomy === taxonomy &&
          requested.has(`${membership.market}:${membership.symbol}`) &&
          (!membership.effectiveFrom || membership.effectiveFrom <= date) &&
          (!membership.effectiveTo || membership.effectiveTo >= date),
      )
      .sort((left, right) => {
        if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
        const effectiveDateOrder = (right.effectiveFrom ?? "").localeCompare(
          left.effectiveFrom ?? "",
        );
        return (
          effectiveDateOrder || right.fetchedAt.localeCompare(left.fetchedAt)
        );
      });
    const current = new Map<string, IndustryMembership>();
    for (const membership of candidates) {
      const key = `${membership.market}:${membership.symbol}`;
      if (!current.has(key)) current.set(key, membership);
    }
    return [...current.values()];
  }

  async saveIndustryBars(bars: readonly IndustryMarketBar[]) {
    for (const bar of bars) this.industryBars.set(bar.id, bar);
  }

  async getLatestIndustryBars(
    industryCodes: readonly string[],
    asOf: Date,
    taxonomy: string,
  ) {
    const requested = new Set(industryCodes);
    const date = asOf.toISOString();
    const candidates = [...this.industryBars.values()]
      .filter(
        (bar) =>
          bar.taxonomy === taxonomy &&
          requested.has(bar.industryCode) &&
          bar.tradeDate <= date,
      )
      .sort((left, right) => right.tradeDate.localeCompare(left.tradeDate));
    const latest = new Map<string, IndustryMarketBar>();
    for (const bar of candidates) {
      if (!latest.has(bar.industryCode)) latest.set(bar.industryCode, bar);
    }
    return [...latest.values()];
  }
}
