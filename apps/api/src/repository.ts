import { createHash, randomUUID } from "node:crypto";
import type {
  AgentRun,
  IndustryTag,
  PortfolioHistoryPoint,
  PortfolioSnapshot,
} from "@portfolio/domain";
import type {
  IndustryMarketBar,
  IndustryMembership,
  SecurityReference,
} from "./industry.js";

export type SnapshotSaveResult = "created" | "existing";

export interface SecurityIndustryTagAssignment {
  source: string;
  sourceAccountId: string;
  market: string;
  symbol: string;
  tagId: string;
  tagName: string;
  color: string;
  updatedAt: string;
}

export interface SaveIndustryTagAssignmentInput {
  userId: string;
  source: string;
  sourceAccountId: string;
  market: string;
  symbol: string;
  tagId: string;
}

export interface CreateIndustryTagInput {
  name: string;
  color: string;
}

export class IndustryTagNameConflictError extends Error {}

export interface PortfolioRepository {
  healthCheck(): Promise<void>;
  saveSnapshot(userId: string, snapshot: PortfolioSnapshot): Promise<SnapshotSaveResult>;
  saveAgentRun(userId: string, run: AgentRun): Promise<void>;
  getLatestSnapshot(userId: string, accountId?: string): Promise<PortfolioSnapshot | null>;
  getLatestAgentRun(userId: string, snapshotId: string): Promise<AgentRun | null>;
  getHistory(
    userId: string,
    accountId: string,
    limit: number,
  ): Promise<PortfolioHistoryPoint[]>;
  getIndustryTags(userId: string): Promise<IndustryTag[]>;
  createIndustryTag(
    userId: string,
    input: CreateIndustryTagInput,
  ): Promise<IndustryTag>;
  deleteIndustryTag(userId: string, tagId: string): Promise<boolean>;
  getIndustryTagAssignments(
    userId: string,
    source: string,
    sourceAccountId: string,
    securities: readonly SecurityReference[],
  ): Promise<SecurityIndustryTagAssignment[]>;
  saveIndustryTagAssignment(
    input: SaveIndustryTagAssignmentInput,
  ): Promise<SecurityIndustryTagAssignment>;
  deleteIndustryTagAssignment(
    userId: string,
    source: string,
    sourceAccountId: string,
    market: string,
    symbol: string,
  ): Promise<void>;
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
  private readonly industryTags = new Map<string, IndustryTag>();
  private readonly industryTagAssignments = new Map<
    string,
    SecurityIndustryTagAssignment
  >();

  async healthCheck() {}

  async saveSnapshot(userId: string, snapshot: PortfolioSnapshot) {
    const key = `${userId}:${snapshot.id}`;
    const existing = this.snapshots.get(key);
    if (existing) {
      if (snapshotContentHash(existing) !== snapshotContentHash(snapshot)) {
        throw new Error("同一快照 ID 对应了不同内容，已拒绝覆盖历史数据");
      }
      return "existing" as const;
    }
    this.snapshots.set(key, snapshot);
    return "created" as const;
  }

  async saveAgentRun(userId: string, run: AgentRun) {
    this.runs.set(`${userId}:${run.id}`, run);
  }

  async getLatestSnapshot(userId: string, accountId?: string) {
    return (
      [...this.snapshots.entries()]
        .filter(
          ([key, snapshot]) =>
            key.startsWith(`${userId}:`) &&
            (accountId === undefined || snapshot.sourceAccountId === accountId),
        )
        .map(([, snapshot]) => snapshot)
        .sort((left, right) =>
          right.capturedAt.localeCompare(left.capturedAt),
        )[0] ?? null
    );
  }

  async getLatestAgentRun(userId: string, snapshotId: string) {
    return (
      [...this.runs.entries()]
        .filter(
          ([key, run]) =>
            key.startsWith(`${userId}:`) && run.snapshotId === snapshotId,
        )
        .map(([, run]) => run)
        .sort((left, right) =>
          right.requestedAt.localeCompare(left.requestedAt),
        )[0] ?? null
    );
  }

  async getHistory(userId: string, accountId: string, limit: number) {
    return [...this.snapshots.entries()]
      .filter(
        ([key, snapshot]) =>
          key.startsWith(`${userId}:`) && snapshot.sourceAccountId === accountId,
      )
      .map(([, snapshot]) => snapshot)
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))
      .slice(-limit)
      .map((snapshot) => ({
        date: snapshot.capturedAt.slice(0, 10),
        totalAsset: snapshot.totalAsset,
        positionRate: snapshot.positionRate,
      }));
  }

  async getIndustryTags(userId: string) {
    return [...this.industryTags.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, tag]) => ({ ...tag }))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  async createIndustryTag(userId: string, input: CreateIndustryTagInput) {
    const existing = (await this.getIndustryTags(userId)).find(
      (tag) => tag.name === input.name,
    );
    if (existing) throw new IndustryTagNameConflictError("标签名称已存在");
    const tags = await this.getIndustryTags(userId);
    const tag: IndustryTag = {
      id: randomUUID(),
      name: input.name,
      color: input.color,
      sortOrder: tags.length === 0
        ? 0
        : Math.max(...tags.map((candidate) => candidate.sortOrder)) + 1,
    };
    this.industryTags.set(`${userId}:${tag.id}`, tag);
    return { ...tag };
  }

  async deleteIndustryTag(userId: string, tagId: string) {
    const deleted = this.industryTags.delete(`${userId}:${tagId}`);
    if (deleted) {
      for (const [key, assignment] of this.industryTagAssignments.entries()) {
        if (key.startsWith(`${userId}:`) && assignment.tagId === tagId) {
          this.industryTagAssignments.delete(key);
        }
      }
    }
    return deleted;
  }

  async getIndustryTagAssignments(
    userId: string,
    source: string,
    sourceAccountId: string,
    securities: readonly SecurityReference[],
  ) {
    const requested = new Set(
      securities.map((security) => `${security.market}:${security.symbol}`),
    );
    return [...this.industryTagAssignments.entries()]
      .filter(
      ([key, assignment]) =>
        key.startsWith(`${userId}:`) &&
        assignment.source === source &&
        assignment.sourceAccountId === sourceAccountId &&
        requested.has(`${assignment.market}:${assignment.symbol}`),
      )
      .map(([, assignment]) => assignment);
  }

  async saveIndustryTagAssignment(input: SaveIndustryTagAssignmentInput) {
    const tag = this.industryTags.get(`${input.userId}:${input.tagId}`);
    if (!tag) throw new Error("行业标签不存在");
    const assignment: SecurityIndustryTagAssignment = {
      source: input.source,
      sourceAccountId: input.sourceAccountId,
      market: input.market,
      symbol: input.symbol,
      tagId: input.tagId,
      tagName: tag.name,
      color: tag.color,
      updatedAt: new Date().toISOString(),
    };
    this.industryTagAssignments.set(
      `${input.userId}:${input.source}:${input.sourceAccountId}:${input.market}:${input.symbol}`,
      assignment,
    );
    return assignment;
  }

  async deleteIndustryTagAssignment(
    userId: string,
    source: string,
    sourceAccountId: string,
    market: string,
    symbol: string,
  ) {
    this.industryTagAssignments.delete(
      `${userId}:${source}:${sourceAccountId}:${market}:${symbol}`,
    );
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
