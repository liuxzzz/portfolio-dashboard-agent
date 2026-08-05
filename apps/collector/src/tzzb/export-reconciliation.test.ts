import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot, PositionSnapshot } from "@portfolio/domain";
import { holdingExportFields } from "./export-contract.js";
import { reconcileHoldingExport } from "./export-reconciliation.js";
import { parseHoldingExportRows } from "./export-workbook.js";

const position = {
  symbol: "000001",
  name: "虚构股份",
  market: "0",
  industry: null,
  quantity: 100,
  currentPrice: 9,
  unitCost: 10,
  marketValue: 900,
  portfolioWeight: 0.9,
  dayProfit: 10,
  dayProfitRate: 0.0112,
  holdingProfit: -100,
  holdingProfitRate: -0.1,
  holdingDays: 5,
  latestRate: 0.0123,
  relatedSector: null,
  sectorRate: null,
  combinationProfit: null,
  combinationRate: null,
  cumulativeProfit: -90,
  cumulativeProfitRate: null,
  weekProfit: 20,
  monthProfit: 30,
  yearProfit: 40,
  breakEvenRate: 1 / 9,
  oneMonthRate: 0.02,
  threeMonthRate: 0.03,
  sixMonthRate: 0.04,
  oneYearRate: 0.05,
} satisfies PositionSnapshot;

function snapshot(positions: PositionSnapshot[] = [position]) {
  return {
    id: "snapshot-test",
    source: "tzzb",
    sourceAccountId: "account-test",
    accountName: "虚构账户",
    capturedAt: "2026-08-05T08:30:00.000Z",
    sourceSyncedAt: "2026-08-05T08:00:00.000Z",
    freshness: "fresh",
    currency: "CNY",
    totalAsset: 1_000,
    cash: 100,
    stockMarketValue: 900,
    dayProfit: 10,
    dayProfitRate: 0.01,
    positionRate: 0.9,
    positions,
  } satisfies PortfolioSnapshot;
}

const headers = holdingExportFields.map((field) => field.header);

function rowFromPosition(value: PositionSnapshot) {
  return holdingExportFields.map((field) => value[field.snapshotKey] ?? null);
}

test("parses holding rows and excludes the account summary row", () => {
  const exported = parseHoldingExportRows([
    headers,
    rowFromPosition(position),
    ["账户汇总", null, 900, 10],
  ]);

  assert.equal(exported.positions.length, 1);
  assert.equal(exported.positions[0]?.symbol, "000001");
  assert.equal(exported.ignoredSummaryRows, 1);
});

test("reconciles all 27 fields without returning portfolio values", () => {
  const exported = parseHoldingExportRows([
    headers,
    rowFromPosition(position),
    ["账户汇总", null, 900, 10],
  ]);
  const report = reconcileHoldingExport(snapshot(), exported);

  assert.equal(report.complete, true);
  assert.equal(report.fields.length, 27);
  assert.equal(
    report.fields.filter((field) => field.status === "matched").length,
    22,
  );
  assert.equal(
    report.fields.filter((field) => field.status === "blank-by-source").length,
    5,
  );
  assert.equal(JSON.stringify(report).includes("000001"), false);
  assert.equal(JSON.stringify(report).includes("虚构股份"), false);
});

test("reports numeric mismatches and asymmetric blanks", () => {
  const exportRow = rowFromPosition(position);
  exportRow[20] = 9.01;
  exportRow[21] = null;
  const report = reconcileHoldingExport(
    snapshot(),
    parseHoldingExportRows([headers, exportRow]),
  );

  assert.equal(report.complete, false);
  assert.equal(
    report.fields.find((field) => field.header === "最新价")?.status,
    "mismatch",
  );
  assert.equal(
    report.fields.find((field) => field.header === "单位成本")?.apiOnly,
    1,
  );
});

test("rejects a reordered export contract", () => {
  const reordered = [...headers];
  [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];

  assert.throws(
    () => parseHoldingExportRows([reordered, rowFromPosition(position)]),
    /字段结构发生变化/,
  );
});
