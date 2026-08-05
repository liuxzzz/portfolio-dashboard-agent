import assert from "node:assert/strict";
import test from "node:test";
import type { PositionSnapshot } from "@portfolio/domain";
import { holdingExportFields } from "./tzzb/export-contract.js";
import { parseHoldingExportRows } from "./tzzb/export-workbook.js";
import {
  createSnapshotFromHoldingExport,
  inferMarket,
} from "./xlsx-import.js";

const headers = holdingExportFields.map((field) => field.header);

function row(position: PositionSnapshot) {
  return holdingExportFields.map((field) => position[field.snapshotKey] ?? null);
}

const position = {
  symbol: "000001",
  name: "虚构股份",
  market: "SZ",
  industry: null,
  quantity: 100,
  currentPrice: 9,
  unitCost: 8,
  marketValue: 900,
  portfolioWeight: 0.9,
  dayProfit: 10,
  dayProfitRate: 0.0112,
  holdingProfit: 100,
  holdingProfitRate: 0.125,
  holdingDays: 5,
  latestRate: 0.01,
  relatedSector: null,
  sectorRate: 0.002,
  combinationProfit: 100,
  combinationRate: 0.125,
  cumulativeProfit: 110,
  cumulativeProfitRate: 0.1375,
  weekProfit: 20,
  monthProfit: 30,
  yearProfit: 40,
  breakEvenRate: -1 / 9,
  oneMonthRate: 0.02,
  threeMonthRate: 0.03,
  sixMonthRate: 0.04,
  oneYearRate: 0.05,
} satisfies PositionSnapshot;

function exported(summaryMarketValue = 900) {
  const summary = Array<unknown>(headers.length).fill(null);
  summary[0] = "汇总";
  summary[2] = summaryMarketValue;
  summary[3] = 10;
  summary[4] = 0.01;
  summary[16] = 0.9;
  return parseHoldingExportRows([headers, row(position), summary]);
}

test("builds a deterministic portfolio snapshot from the holding export", () => {
  const options = {
    capturedAt: new Date("2026-08-05T02:00:00.000Z"),
    sourceFingerprint: "fixture",
  };
  const snapshot = createSnapshotFromHoldingExport(exported(), options);
  const repeated = createSnapshotFromHoldingExport(exported(), options);

  assert.equal(snapshot.id, repeated.id);
  assert.equal(snapshot.sourceAccountId, "local-xlsx");
  assert.equal(snapshot.totalAsset, 1_000);
  assert.equal(snapshot.stockMarketValue, 900);
  assert.equal(snapshot.cash, 100);
  assert.equal(snapshot.positionRate, 0.9);
  assert.equal(snapshot.dayProfit, 10);
  assert.equal(snapshot.dayProfitRate, 0.01);
  assert.equal(snapshot.positions[0]?.market, "SZ");
});

test("rejects a summary that does not reconcile to position rows", () => {
  assert.throws(
    () =>
      createSnapshotFromHoldingExport(exported(901), {
        capturedAt: new Date("2026-08-05T02:00:00.000Z"),
      }),
    /持有金额.*不一致/,
  );
});

test("infers common mainland and Hong Kong market codes", () => {
  assert.equal(inferMarket("600000"), "SH");
  assert.equal(inferMarket("159001"), "SZ");
  assert.equal(inferMarket("830001"), "BJ");
  assert.equal(inferMarket("00700"), "HK");
});
