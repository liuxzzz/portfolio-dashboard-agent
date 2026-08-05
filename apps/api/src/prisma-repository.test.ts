import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { analyzePortfolio } from "@portfolio/agent-core";
import type { PortfolioSnapshot } from "@portfolio/domain";
import { createPrismaClient } from "./prisma.js";
import { PrismaPortfolioRepository } from "./prisma-repository.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "persists immutable snapshots and agent runs in PostgreSQL",
  { skip: databaseUrl ? false : "TEST_DATABASE_URL is not configured" },
  async (context) => {
    assert.ok(databaseUrl);
    const suffix = randomUUID();
    const snapshotId = `snapshot-db-${suffix}`;
    const sourceAccountId = `account-db-${suffix}`;
    const prisma = createPrismaClient(databaseUrl);
    const repository = new PrismaPortfolioRepository(prisma);

    context.after(async () => {
      await prisma.snapshot.deleteMany({ where: { id: snapshotId } });
      await prisma.account.deleteMany({ where: { sourceAccountId } });
      await prisma.$disconnect();
    });

    const snapshot: PortfolioSnapshot = {
      id: snapshotId,
      source: "tzzb",
      sourceAccountId,
      accountName: "数据库集成测试账户",
      capturedAt: "2026-08-05T08:30:00.000Z",
      sourceSyncedAt: "2026-08-05T08:00:00.000Z",
      freshness: "fresh",
      currency: "CNY",
      totalAsset: 100_000.25,
      cash: 5_000.25,
      stockMarketValue: 95_000,
      dayProfit: 300.5,
      dayProfitRate: 0.003005,
      positionRate: 0.95,
      positions: [
        {
          symbol: "600000",
          name: "虚构测试股份",
          market: "SH",
          industry: "金融",
          quantity: 2_000,
          currentPrice: 47.5,
          unitCost: 42.25,
          marketValue: 95_000,
          portfolioWeight: 0.95,
          dayProfit: 300.5,
          dayProfitRate: 0.003174,
          holdingProfit: 10_500,
          holdingProfitRate: 0.12426,
          holdingDays: 100,
          latestRate: 0.006,
          relatedSector: "银行",
          sectorRate: 0.002,
          combinationProfit: 10_500,
          combinationRate: 0.12426,
          cumulativeProfit: 10_800.5,
          cumulativeProfitRate: 0.128,
          weekProfit: 500,
          monthProfit: 1_200,
          yearProfit: 8_000,
          breakEvenRate: -0.1105,
          oneMonthRate: 0.032,
          threeMonthRate: 0.08,
          sixMonthRate: 0.15,
          oneYearRate: 0.21,
        },
      ],
    };

    await repository.healthCheck();
    assert.equal(await repository.saveSnapshot(snapshot), "created");
    assert.equal(await repository.saveSnapshot(snapshot), "existing");
    await assert.rejects(
      repository.saveSnapshot({ ...snapshot, totalAsset: 100_001.25 }),
      /拒绝覆盖历史数据/,
    );

    const storedSnapshot = await repository.getLatestSnapshot(sourceAccountId);
    assert.deepEqual(storedSnapshot, snapshot);

    const run = analyzePortfolio(
      snapshot,
      new Date("2026-08-05T09:00:00.000Z"),
    );
    await repository.saveAgentRun(run);
    await repository.saveAgentRun(run);
    assert.deepEqual(await repository.getLatestAgentRun(snapshotId), run);
    assert.deepEqual(await repository.getHistory(sourceAccountId, 30), [
      {
        date: "2026-08-05",
        totalAsset: snapshot.totalAsset,
        positionRate: snapshot.positionRate,
      },
    ]);
  },
);
