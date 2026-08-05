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
  type SaveIndustryOverrideInput,
  type PortfolioRepository,
  type SecurityIndustryOverride,
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

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<SnapshotSaveResult> {
    const contentHash = snapshotContentHash(snapshot);
    const existing = await this.prisma.snapshot.findUnique({
      where: { id: snapshot.id },
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
        const account = await transaction.account.upsert({
          where: {
            source_sourceAccountId: {
              source: snapshot.source,
              sourceAccountId: snapshot.sourceAccountId,
            },
          },
          create: {
            source: snapshot.source,
            sourceAccountId: snapshot.sourceAccountId,
            name: snapshot.accountName,
            currency: snapshot.currency,
          },
          update: {
            name: snapshot.accountName,
            currency: snapshot.currency,
          },
          select: { id: true },
        });

        await transaction.snapshot.create({
          data: {
            id: snapshot.id,
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
                  snapshot.id,
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
          OR: [
            { id: snapshot.id },
            {
              capturedAt: new Date(snapshot.capturedAt),
              account: {
                source: snapshot.source,
                sourceAccountId: snapshot.sourceAccountId,
              },
            },
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

  async saveAgentRun(run: AgentRun) {
    const existing = await this.prisma.agentRun.findUnique({
      where: { id: run.id },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.agentRun.create({
      data: {
        id: run.id,
        snapshotId: run.snapshotId,
        status: run.status,
        requestedAt: new Date(run.requestedAt),
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
        model: run.model,
        disclaimer: run.disclaimer,
        insights: {
          create: run.insights.map((insight) => {
            const internalInsightId = insightId(run.id, insight.id);
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

  async getLatestSnapshot(accountId?: string) {
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
            account: { source: "tzzb", sourceAccountId: accountId },
          },
        })
      : await this.prisma.snapshot.findFirst(query);
    if (!record) return null;

    return portfolioSnapshotSchema.parse({
      id: record.id,
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

  async getLatestAgentRun(snapshotId: string) {
    const record = await this.prisma.agentRun.findFirst({
      where: { snapshotId },
      orderBy: { requestedAt: "desc" },
      include: {
        insights: {
          orderBy: { createdAt: "asc" },
          include: { evidence: { orderBy: { id: "asc" } } },
        },
      },
    });
    if (!record) return null;

    return agentRunSchema.parse({
      id: record.id,
      snapshotId: record.snapshotId,
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

  async getHistory(accountId: string, limit: number) {
    const records = await this.prisma.snapshot.findMany({
      where: {
        account: { source: "tzzb", sourceAccountId: accountId },
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

  async getMainIndustries() {
    return this.prisma.mainIndustry.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        sortOrder: true,
      },
    });
  }

  async getIndustryOverrides(
    source: string,
    sourceAccountId: string,
    securities: readonly SecurityReference[],
  ) {
    if (securities.length === 0) return [];
    const records = await this.prisma.securityIndustryOverride.findMany({
      where: {
        account: { source, sourceAccountId },
        OR: securities.map((security) => ({
          market: security.market,
          symbol: security.symbol,
        })),
      },
      include: { account: true, mainIndustry: true },
    });
    return records.map((record): SecurityIndustryOverride => ({
      source: record.account.source,
      sourceAccountId: record.account.sourceAccountId,
      market: record.market,
      symbol: record.symbol,
      mainIndustryId: record.mainIndustryId,
      mainIndustryName: record.mainIndustry.name,
      color: record.mainIndustry.color,
      updatedAt: record.updatedAt.toISOString(),
    }));
  }

  async saveIndustryOverride(input: SaveIndustryOverrideInput) {
    const [account, industry] = await Promise.all([
      this.prisma.account.findUnique({
        where: {
          source_sourceAccountId: {
            source: input.source,
            sourceAccountId: input.sourceAccountId,
          },
        },
      }),
      this.prisma.mainIndustry.findFirst({
        where: { id: input.mainIndustryId, isActive: true },
      }),
    ]);
    if (!account) throw new Error("账户不存在");
    if (!industry) throw new Error("主行业不存在或已停用");

    const record = await this.prisma.securityIndustryOverride.upsert({
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
        mainIndustryId: input.mainIndustryId,
      },
      update: { mainIndustryId: input.mainIndustryId },
      include: { mainIndustry: true },
    });
    return {
      ...input,
      mainIndustryName: record.mainIndustry.name,
      color: record.mainIndustry.color,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async deleteIndustryOverride(
    source: string,
    sourceAccountId: string,
    market: string,
    symbol: string,
  ) {
    await this.prisma.securityIndustryOverride.deleteMany({
      where: {
        account: { source, sourceAccountId },
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
