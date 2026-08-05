import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot } from "@portfolio/domain";
import {
  INDUSTRY_TAXONOMY,
  PortfolioIndustryService,
  type IndustryProvider,
} from "./industry.js";
import { MemoryPortfolioRepository } from "./repository.js";

const snapshot: PortfolioSnapshot = {
  id: "snapshot-industry-test",
  source: "tzzb",
  sourceAccountId: "account-industry-test",
  accountName: "行业测试账户",
  capturedAt: "2026-08-05T08:30:00.000Z",
  sourceSyncedAt: "2026-08-05T08:00:00.000Z",
  freshness: "fresh",
  currency: "CNY",
  totalAsset: 100_000,
  cash: 20_000,
  stockMarketValue: 80_000,
  dayProfit: 300,
  dayProfitRate: 0.003,
  positionRate: 0.8,
  positions: [
    {
      symbol: "600000",
      name: "虚构银行",
      market: "SH",
      industry: null,
      quantity: 2_000,
      currentPrice: 40,
      unitCost: 35,
      marketValue: 80_000,
      portfolioWeight: 0.8,
      dayProfit: 300,
      dayProfitRate: 0.0038,
      holdingProfit: 10_000,
      holdingProfitRate: 0.1429,
      holdingDays: 100,
    },
  ],
};

test("enriches a portfolio from versioned SW membership and daily bars", async () => {
  const repository = new MemoryPortfolioRepository();
  await repository.saveSnapshot(snapshot);
  let membershipCalls = 0;
  let barCalls = 0;
  const provider: IndustryProvider = {
    async fetchMemberships(securities) {
      membershipCalls += 1;
      assert.deepEqual(securities, [{ market: "SH", symbol: "600000" }]);
      return [
        {
          id: "membership-bank",
          taxonomy: INDUSTRY_TAXONOMY,
          market: "SH",
          symbol: "600000",
          level1Code: "801780.SI",
          level1Name: "银行",
          level2Code: "801783.SI",
          level2Name: "股份制银行Ⅱ",
          level3Code: "850192.SI",
          level3Name: "股份制银行Ⅲ",
          effectiveFrom: "2021-12-13T00:00:00.000Z",
          effectiveTo: null,
          isCurrent: true,
          source: "test:index_member_all",
          fetchedAt: "2026-08-05T09:00:00.000Z",
        },
      ];
    },
    async fetchDailyBars(codes, startDate, endDate) {
      barCalls += 1;
      assert.deepEqual(codes, ["801780.SI"]);
      assert.equal(startDate, "2026-07-22");
      assert.equal(endDate, "2026-08-05");
      return [
        {
          id: "bar-bank-20260805",
          taxonomy: INDUSTRY_TAXONOMY,
          industryCode: "801780.SI",
          industryName: "银行",
          tradeDate: "2026-08-05T00:00:00.000Z",
          close: 3_100,
          pctChange: 1.23,
          source: "test:sw_daily",
          fetchedAt: "2026-08-05T09:00:00.000Z",
        },
      ];
    },
  };
  const service = new PortfolioIndustryService(
    repository,
    provider,
    () => new Date("2026-08-05T09:00:00.000Z"),
  );

  const first = await service.enrich(snapshot);
  assert.equal(first.snapshot.positions[0]?.industry, "银行");
  assert.equal(first.snapshot.positions[0]?.relatedSector, "股份制银行Ⅲ");
  assert.equal(first.snapshot.positions[0]?.sectorRate, 0.0123);
  assert.deepEqual(first.industries[0], {
    name: "银行",
    code: "801780.SI",
    value: 80_000,
    weight: 0.8,
    dayRate: 0.0123,
    color: "#172033",
  });
  assert.equal(first.industryData.status, "fresh");

  const second = await service.enrich(snapshot);
  assert.equal(second.industryData.status, "fresh");
  assert.equal(membershipCalls, 1);
  assert.equal(barCalls, 1);
  assert.equal(
    (await repository.getLatestSnapshot())?.positions[0]?.industry,
    null,
    "external enrichment must not mutate the immutable source snapshot",
  );
});

test("keeps the dashboard available when the provider fails", async () => {
  const repository = new MemoryPortfolioRepository();
  const provider: IndustryProvider = {
    async fetchMemberships() {
      throw new Error("provider unavailable");
    },
    async fetchDailyBars() {
      throw new Error("provider unavailable");
    },
  };
  const service = new PortfolioIndustryService(repository, provider);
  const result = await service.enrich(snapshot);

  assert.equal(result.industryData.status, "unavailable");
  assert.equal(result.snapshot.positions[0]?.industry, null);
  assert.equal(result.industries[0]?.name, "未分类");
  assert.equal((await service.enrich(snapshot)).industryData.status, "unavailable");
});
