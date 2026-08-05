import assert from "node:assert/strict";
import test from "node:test";
import {
  assessHoldingFieldCoverage,
  holdingExportFields,
  reconcileHoldingHeaders,
} from "./export-contract.js";
import type { PortfolioSnapshot } from "@portfolio/domain";

const authoritativeHeaders = [
  "代码", "名称", "持有金额", "当日盈亏", "当日盈亏率", "关联板块", "板块涨幅",
  "组合盈亏", "组合涨幅", "持有盈亏", "持有盈亏率", "累计盈亏", "累计盈亏率",
  "本周盈亏", "本月盈亏", "今年盈亏", "仓位占比", "持有数量", "持仓天数",
  "最新涨幅", "最新价", "单位成本", "回本涨幅", "近1月涨幅", "近3月涨幅",
  "近6月涨幅", "近1年涨幅",
];

test("matches all 27 holding export columns", () => {
  assert.deepEqual(
    holdingExportFields.map((field) => field.header),
    authoritativeHeaders,
  );
  assert.deepEqual(reconcileHoldingHeaders(authoritativeHeaders), {
    complete: true,
    expectedCount: 27,
    actualCount: 27,
    missing: [],
    unexpected: [],
    duplicates: [],
    orderMatches: true,
  });
  assert.equal(
    holdingExportFields.filter((field) => field.source === "blank-by-source")
      .length,
    5,
  );
});

test("detects reordered export columns", () => {
  const reordered = [...authoritativeHeaders];
  [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];

  assert.equal(reconcileHoldingHeaders(reordered).complete, false);
  assert.equal(reconcileHoldingHeaders(reordered).orderMatches, false);
});

test("reports field coverage without exposing portfolio values", () => {
  const snapshot = {
    id: "snapshot-test",
    source: "tzzb",
    sourceAccountId: "account-test",
    accountName: "虚构账户",
    capturedAt: "2026-08-05T08:30:00.000Z",
    sourceSyncedAt: "2026-08-05T08:00:00.000Z",
    freshness: "fresh",
    currency: "CNY",
    totalAsset: 100,
    cash: 0,
    stockMarketValue: 100,
    dayProfit: null,
    dayProfitRate: null,
    positionRate: 1,
    positions: [
      {
        symbol: "000001",
        name: "虚构股份",
        market: "0",
        industry: null,
        quantity: 10,
        currentPrice: 10,
        unitCost: null,
        marketValue: 100,
        portfolioWeight: 1,
        dayProfit: null,
        dayProfitRate: null,
        holdingProfit: 0,
        holdingProfitRate: 0,
        holdingDays: 1,
        latestRate: 0,
        relatedSector: null,
        sectorRate: null,
        combinationProfit: null,
        combinationRate: null,
        cumulativeProfit: 0,
        cumulativeProfitRate: null,
        weekProfit: 0,
        monthProfit: 0,
        yearProfit: 0,
        breakEvenRate: null,
        oneMonthRate: 0,
        threeMonthRate: 0,
        sixMonthRate: 0,
        oneYearRate: 0,
      },
    ],
  } satisfies PortfolioSnapshot;

  const coverage = assessHoldingFieldCoverage(snapshot);
  assert.equal(coverage.length, 27);
  assert.deepEqual(coverage.find((field) => field.header === "代码"), {
    header: "代码",
    source: "direct",
    status: "complete",
    populated: 1,
    total: 1,
  });
  assert.equal(
    coverage.find((field) => field.header === "单位成本")?.status,
    "empty",
  );
  assert.equal(
    coverage.find((field) => field.header === "关联板块")?.status,
    "blank-by-source",
  );
  assert.equal(JSON.stringify(coverage).includes("000001"), false);
});
