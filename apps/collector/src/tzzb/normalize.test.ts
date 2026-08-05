import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSnapshot } from "./normalize.js";
import { stockPositionResponseSchema } from "./schemas.js";

test("normalizes quote deltas, daily profit, rates, and export extension fields", () => {
  const snapshot = normalizeSnapshot({
    account: {
      kind: "manual",
      sourceAccountId: "fictional-account",
      accountName: "虚构测试账户",
      manualId: "fictional-account",
      fundKey: "",
      marginFundKey: "",
    },
    positionResponse: stockPositionResponseSchema.parse({
      upload_time: "2026-08-05 16:00:00",
      total_liability: "0",
      money_remain: "20000",
      total_value: "30000",
      total_asset: "10000",
      position_rate: "33.33",
      position: [
        {
          code: "600000",
          name: "虚构股份",
          market: "17",
          hkmarket: "0",
          price: "10",
          count: "1000",
          hold_days: "20",
          cost: "9",
          value: "10000",
          hold_profit: "1000",
          hold_rate: "11.11",
          close_profit: "200",
          w_profit: "500",
          m_profit: "600",
          y_profit: "700",
          m1_rate: "5",
          m3_rate: "10",
          m6_rate: "15",
          m12_rate: "20",
        },
      ],
    }),
    trades: [],
    transfers: [],
    quotes: [
      { scdm: "17", zqdm: "600000", xianjia: "11", zuoshou: "10.5" },
    ],
    capturedAt: new Date("2026-08-05T08:30:00.000Z"),
    rateUnit: "percent",
  });

  assert.equal(snapshot.totalAsset, 31_000);
  assert.equal(snapshot.stockMarketValue, 11_000);
  assert.equal(snapshot.dayProfit, 500);
  assert.equal(snapshot.freshness, "fresh");

  const position = snapshot.positions[0]!;
  assert.equal(position.marketValue, 11_000);
  assert.equal(position.holdingProfit, 2_000);
  assert.equal(position.cumulativeProfit, 2_200);
  assert.equal(position.weekProfit, 1_500);
  assert.equal(position.monthProfit, 1_600);
  assert.equal(position.yearProfit, 1_700);
  assert.equal(position.dayProfit, 500);
  assert.equal(position.relatedSector, null);
  assert.equal(position.breakEvenRate, null);
  assert.ok(Math.abs((position.oneMonthRate ?? 0) - 0.155) < 1e-12);
  assert.ok(Math.abs((position.portfolioWeight ?? 0) - 11 / 31) < 1e-12);
});

test("includes intraday buys and fees in daily profit", () => {
  const snapshot = normalizeSnapshot({
    account: {
      kind: "manual",
      sourceAccountId: "fictional-account-2",
      accountName: "虚构测试账户二",
      manualId: "fictional-account-2",
      fundKey: "",
      marginFundKey: "",
    },
    positionResponse: stockPositionResponseSchema.parse({
      upload_time: "2026-08-05 16:00:00",
      money_remain: "10000",
      total_value: "21000",
      total_asset: "11000",
      position_rate: "52.38",
      position: [
        {
          code: "600001",
          name: "虚构科技",
          market: "17",
          hkmarket: "0",
          price: "11",
          count: "1000",
          hold_days: "1",
          cost: "10.5",
          value: "11000",
          hold_profit: "500",
          hold_rate: "4.76",
          close_profit: "0",
        },
      ],
    }),
    trades: [
      {
        zqdm: "600001",
        zqmc: "虚构科技",
        market: "17",
        cjjg: "10.8",
        czlx: "买入",
        cjsl: "200",
        czdm: "buy",
        fee: "5",
      },
    ],
    transfers: [],
    quotes: [
      { scdm: "17", zqdm: "600001", xianjia: "11", zuoshou: "10" },
    ],
    capturedAt: new Date("2026-08-05T08:30:00.000Z"),
  });

  // Opening 800 shares gained 1; today's 200-share buy gained 0.2; fee is 5.
  assert.ok(Math.abs((snapshot.positions[0]?.dayProfit ?? 0) - 835) < 1e-12);
});

test("only exposes break-even rate for a losing position", () => {
  const snapshot = normalizeSnapshot({
    account: {
      kind: "manual",
      sourceAccountId: "fictional-account-3",
      accountName: "虚构测试账户三",
      manualId: "fictional-account-3",
      fundKey: "",
      marginFundKey: "",
    },
    positionResponse: stockPositionResponseSchema.parse({
      upload_time: "2026-08-05 16:00:00",
      money_remain: "0",
      total_value: "1100",
      total_asset: "1100",
      position_rate: "100",
      position: [
        {
          code: "600002",
          name: "虚构制造",
          market: "17",
          hkmarket: "0",
          price: "11",
          count: "100",
          hold_days: "3",
          cost: "12",
          value: "1100",
          hold_profit: "-100",
          hold_rate: "-8.33",
          close_profit: "0",
        },
      ],
    }),
    trades: [],
    transfers: [],
    quotes: [
      { scdm: "17", zqdm: "600002", xianjia: "11", zuoshou: "11" },
    ],
    capturedAt: new Date("2026-08-05T08:30:00.000Z"),
  });

  assert.ok(
    Math.abs((snapshot.positions[0]?.breakEvenRate ?? 0) - 1 / 11) < 1e-12,
  );
});
