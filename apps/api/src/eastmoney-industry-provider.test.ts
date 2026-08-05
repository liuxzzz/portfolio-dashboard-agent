import assert from "node:assert/strict";
import test from "node:test";
import {
  EASTMONEY_INDUSTRY_TAXONOMY,
  EastmoneyIndustryProvider,
} from "./eastmoney-industry-provider.js";

test("normalizes A-share, HK and ETF industries from free Eastmoney data", async () => {
  const requests: URL[] = [];
  const fetchImplementation: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/suggest/get")) {
      const boards: Record<string, { code: string; name: string }> = {
        半导体: { code: "BK1036", name: "半导体" },
        半导体材料: { code: "BK1325", name: "半导体材料" },
      };
      const board = boards[url.searchParams.get("input") ?? ""];
      return Response.json({
        QuotationCodeTable: {
          Data: board
            ? [
                {
                  Code: board.code,
                  Name: board.name,
                  MktNum: "90",
                  Classify: "BK",
                },
              ]
            : null,
        },
      });
    }
    if (url.pathname.endsWith("/stock/get")) {
      assert.equal(url.searchParams.get("secid"), "1.688521");
      return Response.json({
        rc: 0,
        data: { f57: "688521", f58: "芯原股份", f127: "半导体" },
      });
    }
    if (url.searchParams.get("reportName") === "RPT_HKF10_INFO_ORGPROFILE") {
      assert.equal(
        url.searchParams.get("filter"),
        '(SECUCODE="00981.HK")',
      );
      return Response.json({
        success: true,
        result: {
          data: [
            {
              SECUCODE: "00981.HK",
              SECURITY_CODE: "00981",
              ORG_NAME: "中芯国际集成电路制造有限公司",
              BELONG_INDUSTRY: "半导体",
            },
          ],
        },
      });
    }
    if (url.pathname.endsWith("/stock/kline/get")) {
      assert.equal(url.searchParams.get("secid"), "90.BK1036");
      assert.equal(url.searchParams.get("beg"), "20260722");
      assert.equal(url.searchParams.get("end"), "20260805");
      return Response.json({
        rc: 0,
        data: {
          code: "BK1036",
          name: "半导体",
          klines: [
            "2026-08-04,2356.74,2469.70,2487.06,2336.36,42702028,339655089103.00,6.47,6.00,139.85,4.88",
            "2026-08-05,2464.32,2610.97,2639.39,2464.32,51027238,418209766945.00,7.09,5.72,141.27,5.83",
          ],
        },
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  const provider = new EastmoneyIndustryProvider({
    fetchImplementation,
    concurrency: 1,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });

  const memberships = await provider.fetchMemberships([
    { market: "SH", symbol: "688521", name: "芯原股份" },
    { market: "HK", symbol: "00981", name: "中芯国际" },
    { market: "SH", symbol: "562590", name: "半导材料" },
  ]);

  assert.equal(memberships.length, 3);
  assert.deepEqual(
    memberships.map(({ market, symbol, level1Code, level1Name, source }) => ({
      market,
      symbol,
      level1Code,
      level1Name,
      source,
    })),
    [
      {
        market: "SH",
        symbol: "688521",
        level1Code: "BK1036",
        level1Name: "半导体",
        source: "eastmoney:stock_info",
      },
      {
        market: "HK",
        symbol: "00981",
        level1Code: "HK:dcc56252e4af",
        level1Name: "半导体",
        source: "eastmoney:hk_company_profile",
      },
      {
        market: "SH",
        symbol: "562590",
        level1Code: "BK1325",
        level1Name: "半导体材料",
        source: "local:etf_name_rule",
      },
    ],
  );
  assert.equal(memberships[0]?.taxonomy, EASTMONEY_INDUSTRY_TAXONOMY);
  assert.equal(memberships[2]?.level2Name, "半导材料（指数基金）");

  const bars = await provider.fetchDailyBars(
    ["BK1036", "HK:dcc56252e4af"],
    "2026-07-22",
    "2026-08-05",
  );
  assert.equal(bars.length, 2);
  assert.deepEqual(
    {
      code: bars[1]?.industryCode,
      name: bars[1]?.industryName,
      tradeDate: bars[1]?.tradeDate,
      close: bars[1]?.close,
      pctChange: bars[1]?.pctChange,
    },
    {
      code: "BK1036",
      name: "半导体",
      tradeDate: "2026-08-05T00:00:00.000Z",
      close: 2_610.97,
      pctChange: 5.72,
    },
  );
  assert.equal(
    requests.filter((request) => request.pathname.endsWith("/stock/get"))
      .length,
    1,
    "ETF classification must not require one remote stock-profile call per fund",
  );
});

test("rejects a failed Eastmoney stock profile response", async () => {
  const fetchImplementation: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.ok(url.pathname.endsWith("/stock/get"));
    return Response.json({ rc: 2, data: null });
  };
  const provider = new EastmoneyIndustryProvider({ fetchImplementation });

  await assert.rejects(
    provider.fetchMemberships([
      { market: "SH", symbol: "688521", name: "芯原股份" },
    ]),
    /股票资料 688521请求失败：rc 2/,
  );
});

test("does not replace cached board mappings when Eastmoney search is down", async () => {
  const fetchImplementation: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/stock/get")) {
      return Response.json({
        rc: 0,
        data: { f57: "688521", f58: "芯原股份", f127: "半导体" },
      });
    }
    assert.ok(url.pathname.endsWith("/suggest/get"));
    return new Response("temporarily unavailable", { status: 503 });
  };
  const provider = new EastmoneyIndustryProvider({ fetchImplementation });

  await assert.rejects(
    provider.fetchMemberships([
      { market: "SH", symbol: "688521", name: "芯原股份" },
    ]),
    /行业搜索 半导体请求失败：HTTP 503/,
  );
});
