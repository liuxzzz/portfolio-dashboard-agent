import { createHash } from "node:crypto";
import {
  agentRunSchema,
  portfolioSnapshotSchema,
  type AgentRun,
  type PortfolioSnapshot,
} from "@portfolio/domain";
import type { PortfolioPrismaClient } from "./prisma.js";
import type {
  IndustryMarketBar,
  IndustryMembership,
  SecurityReference,
} from "./industry.js";
import {
  snapshotContentHash,
  IndustryTagNameConflictError,
  type CreateIndustryTagInput,
  type SaveIndustryTagAssignmentInput,
  type PortfolioRepository,
  type SecurityIndustryTagAssignment,
  type SnapshotSaveResult,
} from "./repository.js";

function number(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

function positionId(snapshotId: string, market: string, symbol: string) {
  return `${snapshotId}:${market}:${symbol}`;
}

function insightId(runId: string, sourceInsightId: string) {
  return `${runId}:${sourceInsightId}`;
}

function evidenceId(
  internalInsightId: string,
  referenceId: string,
  index: number,
) {
  return `${internalInsightId}:${index}:${referenceId}`;
}

function tenantEntityId(kind: string, userId: string, externalId: string) {
  return createHash("sha256")
    .update(`${kind}:${userId}:${externalId}`)
    .digest("hex");
}

const LEGACY_USER_ID = "legacy-unassigned";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code?: string }).code === "P2002"
  );
}

export class PrismaPortfolioRepository implements PortfolioRepository {
  constructor(private readonly prisma: PortfolioPrismaClient) {}

  async healthCheck() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async saveSnapshot(
    userId: string,
    snapshot: PortfolioSnapshot,
  ): Promise<SnapshotSaveResult> {
    const contentHash = snapshotContentHash(snapshot);
    const existing = await this.prisma.snapshot.findFirst({
      where: {
        externalId: snapshot.id,
        account: { userId },
      },
      select: { contentHash: true },
    });
    if (existing) {
      if (existing.contentHash !== contentHash) {
        throw new Error("同一快照 ID 对应了不同内容，已拒绝覆盖历史数据");
      }
      return "existing";
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        let account = await transaction.account.findUnique({
          where: {
            userId_source_sourceAccountId: {
              userId,
              source: snapshot.source,
              sourceAccountId: snapshot.sourceAccountId,
            },
          },
          select: { id: true },
        });
        if (!account) {
          const legacy = await transaction.account.findUnique({
            where: {
              userId_source_sourceAccountId: {
                userId: LEGACY_USER_ID,
                source: snapshot.source,
                sourceAccountId: snapshot.sourceAccountId,
              },
            },
            select: { id: true },
          });
          account = legacy
            ? await transaction.account.update({
                where: { id: legacy.id },
                data: {
                  userId,
                  name: snapshot.accountName,
                  currency: snapshot.currency,
                },
                select: { id: true },
              })
            : await transaction.account.create({
                data: {
                  userId,
                  source: snapshot.source,
                  sourceAccountId: snapshot.sourceAccountId,
                  name: snapshot.accountName,
                  currency: snapshot.currency,
                },
                select: { id: true },
              });
        } else {
          await transaction.account.update({
            where: { id: account.id },
            data: {
              name: snapshot.accountName,
              currency: snapshot.currency,
            },
          });
        }

        const internalSnapshotId = tenantEntityId(
          "snapshot",
          userId,
          `${snapshot.source}:${snapshot.sourceAccountId}:${snapshot.id}`,
        );

        await transaction.snapshot.create({
          data: {
            id: internalSnapshotId,
            externalId: snapshot.id,
            accountId: account.id,
            contentHash,
            capturedAt: new Date(snapshot.capturedAt),
            sourceSyncedAt: snapshot.sourceSyncedAt
              ? new Date(snapshot.sourceSyncedAt)
              : null,
            freshness: snapshot.freshness,
            currency: snapshot.currency,
            totalAsset: snapshot.totalAsset,
            cash: snapshot.cash,
            stockMarketValue: snapshot.stockMarketValue,
            dayProfit: snapshot.dayProfit,
            dayProfitRate: snapshot.dayProfitRate,
            positionRate: snapshot.positionRate,
            positions: {
              create: snapshot.positions.map((position) => ({
                id: positionId(
                  internalSnapshotId,
                  position.market,
                  position.symbol,
                ),
                symbol: position.symbol,
                name: position.name,
                market: position.market,
                industry: position.industry,
                quantity: position.quantity,
                currentPrice: position.currentPrice,
                unitCost: position.unitCost,
                marketValue: position.marketValue,
                portfolioWeight: position.portfolioWeight,
                dayProfit: position.dayProfit,
                dayProfitRate: position.dayProfitRate,
                holdingProfit: position.holdingProfit,
                holdingProfitRate: position.holdingProfitRate,
                holdingDays: position.holdingDays,
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
              })),
            },
          },
        });
      });
      return "created";
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const duplicate = await this.prisma.snapshot.findFirst({
        where: {
          account: {
            userId,
            source: snapshot.source,
            sourceAccountId: snapshot.sourceAccountId,
          },
          OR: [
            { externalId: snapshot.id },
            { capturedAt: new Date(snapshot.capturedAt) },
          ],
        },
        select: { contentHash: true },
      });
      if (duplicate?.contentHash === contentHash) return "existing";
      throw new Error(
        "同一账户和采集时间对应了不同快照，已拒绝覆盖历史数据",
        { cause: error },
      );
    }
  }

  async saveAgentRun(userId: string, run: AgentRun) {
    const snapshot = await this.prisma.snapshot.findFirst({
      where: { externalId: run.snapshotId, account: { userId } },
      select: { id: true },
    });
    if (!snapshot) throw new Error("快照不存在或不属于当前用户");
    const existing = await this.prisma.agentRun.findFirst({
      where: { externalId: run.id, snapshotId: snapshot.id },
      select: { id: true },
    });
    if (existing) return;

    const internalRunId = tenantEntityId(
      "agent-run",
      userId,
      `${snapshot.id}:${run.id}`,
    );

    await this.prisma.agentRun.create({
      data: {
        id: internalRunId,
        externalId: run.id,
        snapshotId: snapshot.id,
        status: run.status,
        requestedAt: new Date(run.requestedAt),
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        model: run.model,
        disclaimer: run.disclaimer,
        insights: {
          create: run.insights.map((insight) => {
            const internalInsightId = insightId(internalRunId, insight.id);
            return {
              id: internalInsightId,
              sourceInsightId: insight.id,
              category: insight.category,
              severity: insight.severity,
              title: insight.title,
              summary: insight.summary,
              confidence: insight.confidence,
              createdAt: new Date(insight.createdAt),
              evidence: {
                create: insight.evidence.map((evidence, index) => ({
                  id: evidenceId(
                    internalInsightId,
                    evidence.referenceId,
                    index,
                  ),
                  kind: evidence.kind,
                  referenceId: evidence.referenceId,
                  label: evidence.label,
                  asOf: new Date(evidence.asOf),
                })),
              },
            };
          }),
        },
      },
    });
  }

  async getLatestSnapshot(userId: string, accountId?: string) {
    const query = {
      orderBy: { capturedAt: "desc" as const },
      include: {
        account: true,
        positions: { orderBy: { marketValue: "desc" as const } },
      },
    };
    const record = accountId
      ? await this.prisma.snapshot.findFirst({
          ...query,
          where: {
            account: { userId, source: "tzzb", sourceAccountId: accountId },
          },
        })
      : await this.prisma.snapshot.findFirst({
          ...query,
          where: { account: { userId } },
        });
    if (!record) return null;

    return portfolioSnapshotSchema.parse({
      id: record.externalId,
      source: record.account.source,
      sourceAccountId: record.account.sourceAccountId,
      accountName: record.account.name,
      capturedAt: record.capturedAt.toISOString(),
      sourceSyncedAt: record.sourceSyncedAt?.toISOString() ?? null,
      freshness: record.freshness,
      currency: record.currency,
      totalAsset: number(record.totalAsset),
      cash: number(record.cash),
      stockMarketValue: number(record.stockMarketValue),
      dayProfit: number(record.dayProfit),
      dayProfitRate: number(record.dayProfitRate),
      positionRate: number(record.positionRate),
      positions: record.positions.map((position) => ({
        symbol: position.symbol,
        name: position.name,
        market: position.market,
        industry: position.industry,
        quantity: number(position.quantity),
        currentPrice: number(position.currentPrice),
        unitCost: number(position.unitCost),
        marketValue: number(position.marketValue),
        portfolioWeight: number(position.portfolioWeight),
        dayProfit: number(position.dayProfit),
        dayProfitRate: number(position.dayProfitRate),
        holdingProfit: number(position.holdingProfit),
        holdingProfitRate: number(position.holdingProfitRate),
        holdingDays: position.holdingDays,
        latestRate: number(position.latestRate),
        relatedSector: position.relatedSector,
        sectorRate: number(position.sectorRate),
        combinationProfit: number(position.combinationProfit),
        combinationRate: number(position.combinationRate),
        cumulativeProfit: number(position.cumulativeProfit),
        cumulativeProfitRate: number(position.cumulativeProfitRate),
        weekProfit: number(position.weekProfit),
        monthProfit: number(position.monthProfit),
        yearProfit: number(position.yearProfit),
        breakEvenRate: number(position.breakEvenRate),
        oneMonthRate: number(position.oneMonthRate),
        threeMonthRate: number(position.threeMonthRate),
        sixMonthRate: number(position.sixMonthRate),
        oneYearRate: number(position.oneYearRate),
      })),
    });
  }

  async getLatestAgentRun(userId: string, snapshotId: string) {
    const record = await this.prisma.agentRun.findFirst({
      where: {
        snapshot: { externalId: snapshotId, account: { userId } },
      },
      orderBy: { requestedAt: "desc" },
      include: {
        snapshot: { select: { externalId: true } },
        insights: {
          orderBy: { createdAt: "asc" },
          include: { evidence: { orderBy: { id: "asc" } } },
        },
      },
    });
    if (!record) return null;

    return agentRunSchema.parse({
      id: record.externalId,
      snapshotId: record.snapshot.externalId,
      status: record.status,
      requestedAt: record.requestedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
      model: record.model,
      disclaimer: record.disclaimer,
      insights: record.insights.map((insight) => ({
        id: insight.sourceInsightId,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        summary: insight.summary,
        confidence: number(insight.confidence),
        createdAt: insight.createdAt.toISOString(),
        evidence: insight.evidence.map((evidence) => ({
          kind: evidence.kind,
          referenceId: evidence.referenceId,
          label: evidence.label,
          asOf: evidence.asOf.toISOString(),
        })),
      })),
    });
  }

  async getHistory(userId: string, accountId: string, limit: number) {
    const records = await this.prisma.snapshot.findMany({
      where: {
        account: { userId, source: "tzzb", sourceAccountId: accountId },
      },
      orderBy: { capturedAt: "desc" },
      take: limit,
      select: {
        capturedAt: true,
        totalAsset: true,
        positionRate: true,
      },
    });

    return records.reverse().map((record) => ({
      date: record.capturedAt.toISOString().slice(0, 10),
      totalAsset: number(record.totalAsset) ?? 0,
      positionRate: number(record.positionRate),
    }));
  }

  async getIndustryTags(userId: string) {
    return this.prisma.industryTag.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
      },
    });
  }

  async createIndustryTag(userId: string, input: CreateIndustryTagInput) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const aggregate = await transaction.industryTag.aggregate({
          where: { userId },
          _max: { sortOrder: true },
        });
        return transaction.industryTag.create({
          data: {
            userId,
            name: input.name,
            color: input.color,
            sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          },
          select: { id: true, name: true, color: true, sortOrder: true },
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new IndustryTagNameConflictError("标签名称已存在");
      }
      throw error;
    }
  }

  async deleteIndustryTag(userId: string, tagId: string) {
    const result = await this.prisma.industryTag.deleteMany({
      where: { id: tagId, userId },
    });
    return result.count === 1;
  }

  async getIndustryTagAssignments(
    userId: string,
    source: string,
    sourceAccountId: string,
    securities: readonly SecurityReference[],
  ) {
    if (securities.length === 0) return [];
    const records = await this.prisma.securityIndustryTagAssignment.findMany({
      where: {
        account: { userId, source, sourceAccountId },
        OR: securities.map((security) => ({
          market: security.market,
          symbol: security.symbol,
        })),
      },
      include: { account: true, tag: true },
    });
    return records.map((record): SecurityIndustryTagAssignment => ({
      source: record.account.source,
      sourceAccountId: record.account.sourceAccountId,
      market: record.market,
      symbol: record.symbol,
      tagId: record.tagId,
      tagName: record.tag.name,
      color: record.tag.color,
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async saveIndustryTagAssignment(input: SaveIndustryTagAssignmentInput) {
    const [account, tag] = await Promise.all([
      this.prisma.account.findUnique({
        where: {
          userId_source_sourceAccountId: {
            userId: input.userId,
            source: input.source,
            sourceAccountId: input.sourceAccountId,
          },
        },
      }),
      this.prisma.industryTag.findFirst({
        where: { id: input.tagId, userId: input.userId },
      }),
    ]);
    if (!account) throw new Error("账户不存在");
    if (!tag) throw new Error("行业标签不存在或不属于当前用户");

    const record = await this.prisma.securityIndustryTagAssignment.upsert({
      where: {
        accountId_market_symbol: {
          accountId: account.id,
          market: input.market,
          symbol: input.symbol,
        },
      },
      create: {
        accountId: account.id,
        market: input.market,
        symbol: input.symbol,
        tagId: input.tagId,
      },
      update: { tagId: input.tagId },
      include: { tag: true },
    });
    return {
      source: input.source,
      sourceAccountId: input.sourceAccountId,
      market: input.market,
      symbol: input.symbol,
      tagId: input.tagId,
      tagName: record.tag.name,
      color: record.tag.color,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async deleteIndustryTagAssignment(
    userId: string,
    source: string,
    sourceAccountId: string,
    market: string,
    symbol: string,
  ) {
    await this.prisma.securityIndustryTagAssignment.deleteMany({
      where: {
        account: { userId, source, sourceAccountId },
        market,
        symbol,
      },
    });
  }

  async saveIndustryMemberships(
    memberships: readonly IndustryMembership[],
  ) {
    if (memberships.length === 0) return;
    await this.prisma.$transaction(
      memberships.map((membership) =>
        this.prisma.securityIndustryMembership.upsert({
          where: { id: membership.id },
          create: {
            id: membership.id,
            taxonomy: membership.taxonomy,
            market: membership.market,
            symbol: membership.symbol,
            level1Code: membership.level1Code,
            level1Name: membership.level1Name,
            level2Code: membership.level2Code,
            level2Name: membership.level2Name,
            level3Code: membership.level3Code,
            level3Name: membership.level3Name,
            effectiveFrom: membership.effectiveFrom
              ? new Date(membership.effectiveFrom)
              : null,
            effectiveTo: membership.effectiveTo
              ? new Date(membership.effectiveTo)
              : null,
            isCurrent: membership.isCurrent,
            source: membership.source,
            fetchedAt: new Date(membership.fetchedAt),
          },
          update: {
            level1Code: membership.level1Code,
            level1Name: membership.level1Name,
            level2Code: membership.level2Code,
            level2Name: membership.level2Name,
            level3Code: membership.level3Code,
            level3Name: membership.level3Name,
            effectiveFrom: membership.effectiveFrom
              ? new Date(membership.effectiveFrom)
              : null,
            effectiveTo: membership.effectiveTo
              ? new Date(membership.effectiveTo)
              : null,
            isCurrent: membership.isCurrent,
            source: membership.source,
            fetchedAt: new Date(membership.fetchedAt),
          },
        }),
      ),
    );
  }

  async getIndustryMemberships(
    securities: readonly SecurityReference[],
    asOf: Date,
    taxonomy: string,
  ) {
    if (securities.length === 0) return [];
    const records = await this.prisma.securityIndustryMembership.findMany({
      where: {
        taxonomy,
        OR: securities.map((security) => ({
          market: security.market,
          symbol: security.symbol,
        })),
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: asOf } }] },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
        ],
      },
      orderBy: [
        { isCurrent: "desc" },
        { effectiveFrom: "desc" },
        { fetchedAt: "desc" },
      ],
    });
    const current = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      const key = `${record.market}:${record.symbol}`;
      if (!current.has(key)) current.set(key, record);
    }
    return [...current.values()].map((record) => ({
      id: record.id,
      taxonomy: record.taxonomy,
      market: record.market,
      symbol: record.symbol,
      level1Code: record.level1Code,
      level1Name: record.level1Name,
      level2Code: record.level2Code,
      level2Name: record.level2Name,
      level3Code: record.level3Code,
      level3Name: record.level3Name,
      effectiveFrom: record.effectiveFrom?.toISOString() ?? null,
      effectiveTo: record.effectiveTo?.toISOString() ?? null,
      isCurrent: record.isCurrent,
      source: record.source,
      fetchedAt: record.fetchedAt.toISOString(),
    }));
  }

  async saveIndustryBars(bars: readonly IndustryMarketBar[]) {
    if (bars.length === 0) return;
    await this.prisma.$transaction(
      bars.map((bar) =>
        this.prisma.industryMarketBar.upsert({
          where: { id: bar.id },
          create: {
            id: bar.id,
            taxonomy: bar.taxonomy,
            industryCode: bar.industryCode,
            industryName: bar.industryName,
            tradeDate: new Date(bar.tradeDate),
            close: bar.close,
            pctChange: bar.pctChange,
            source: bar.source,
            fetchedAt: new Date(bar.fetchedAt),
          },
          update: {
            industryName: bar.industryName,
            close: bar.close,
            pctChange: bar.pctChange,
            source: bar.source,
            fetchedAt: new Date(bar.fetchedAt),
          },
        }),
      ),
    );
  }

  async getLatestIndustryBars(
    industryCodes: readonly string[],
    asOf: Date,
    taxonomy: string,
  ) {
    if (industryCodes.length === 0) return [];
    const records = await this.prisma.industryMarketBar.findMany({
      where: {
        taxonomy,
        industryCode: { in: [...industryCodes] },
        tradeDate: { lte: asOf },
      },
      orderBy: { tradeDate: "desc" },
    });
    const latest = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      if (!latest.has(record.industryCode)) {
        latest.set(record.industryCode, record);
      }
    }
    return [...latest.values()].map((record) => ({
      id: record.id,
      taxonomy: record.taxonomy,
      industryCode: record.industryCode,
      industryName: record.industryName,
      tradeDate: record.tradeDate.toISOString(),
      close: number(record.close),
      pctChange: number(record.pctChange),
      source: record.source,
      fetchedAt: record.fetchedAt.toISOString(),
    }));
  }
}
