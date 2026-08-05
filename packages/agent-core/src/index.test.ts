import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot } from "@portfolio/domain";
import { analyzePortfolio } from "./index.js";

const snapshot: PortfolioSnapshot = {
  id: "snapshot-1",
  source: "tzzb",
  sourceAccountId: "account-1",
  accountName: "演示账户",
  capturedAt: "2026-08-05T08:30:00.000Z",
  sourceSyncedAt: "2026-08-05T08:00:00.000Z",
  freshness: "fresh",
  currency: "CNY",
  totalAsset: 100_000,
  cash: 3_000,
  stockMarketValue: 97_000,
  dayProfit: 600,
  dayProfitRate: 0.006,
  positionRate: 0.97,
  positions: [
    {
      symbol: "600000",
      name: "示例股份",
      market: "SH",
      industry: "金融",
      quantity: 1_000,
      currentPrice: 40,
      unitCost: 35,
      marketValue: 40_000,
      portfolioWeight: 0.4,
      dayProfit: 300,
      dayProfitRate: 0.0075,
      holdingProfit: 5_000,
      holdingProfitRate: 0.1429,
      holdingDays: 120,
    },
  ],
};

test("creates grounded concentration and cash insights", () => {
  const run = analyzePortfolio(snapshot, new Date("2026-08-05T09:00:00.000Z"));

  assert.equal(run.status, "completed");
  assert.equal(run.insights.length, 2);
  assert.deepEqual(
    run.insights.map((insight) => insight.category),
    ["concentration", "cash"],
  );
  assert.ok(run.insights.every((insight) => insight.evidence.length > 0));
});

