import assert from "node:assert/strict";
import test from "node:test";
import { TushareIndustryProvider } from "./tushare-industry-provider.js";

test("normalizes Tushare industry memberships and percent-point daily bars", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const fetchImplementation: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push(request);
    if (request.api_name === "index_member_all") {
      return Response.json({
        code: 0,
        msg: null,
        data: {
          fields: [
            "l1_code",
            "l1_name",
            "l2_code",
            "l2_name",
            "l3_code",
            "l3_name",
            "in_date",
            "out_date",
            "is_new",
          ],
          items: [
            [
              "801780.SI",
              "银行",
              "801783.SI",
              "股份制银行Ⅱ",
              "850192.SI",
              "股份制银行Ⅲ",
              "20211213",
              null,
              "Y",
            ],
          ],
        },
      });
    }
    return Response.json({
      code: 0,
      msg: null,
      data: {
        fields: ["ts_code", "trade_date", "name", "close", "pct_change"],
        items: [["801780.SI", "20260805", "银行", 3100.5, 1.23]],
      },
    });
  };
  const provider = new TushareIndustryProvider("test-token", {
    fetchImplementation,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
    concurrency: 1,
  });

  const memberships = await provider.fetchMemberships([
    { market: "SH", symbol: "600000" },
  ]);
  const bars = await provider.fetchDailyBars(
    ["801780.SI"],
    "2026-07-22",
    "2026-08-05",
  );

  assert.equal(
    (requests[0]?.params as { ts_code: string }).ts_code,
    "600000.SH",
  );
  assert.deepEqual(requests[1]?.params, {
    ts_code: "801780.SI",
    start_date: "20260722",
    end_date: "20260805",
  });
  assert.equal(memberships[0]?.level1Name, "银行");
  assert.equal(memberships[0]?.effectiveFrom, "2021-12-13T00:00:00.000Z");
  assert.equal(memberships[0]?.isCurrent, true);
  assert.equal(bars[0]?.tradeDate, "2026-08-05T00:00:00.000Z");
  assert.equal(bars[0]?.pctChange, 1.23);
  assert.equal(requests[0]?.token, "test-token");
});
