import assert from "node:assert/strict";
import test from "node:test";
import { TzzbClient, tzzbEndpoints } from "./client.js";
import type { TzzbTransport } from "./transport.js";

test("calls the complete current-holdings endpoint chain", async () => {
  const calls: Array<{ path: string; params: Record<string, string> }> = [];
  const responses = new Map<string, unknown>([
    [tzzbEndpoints.accounts, { manual: [{ manualid: "m-1", manualname: "虚构账户" }] }],
    [
      tzzbEndpoints.positions,
      {
        upload_time: "2026-08-05 16:00:00",
        money_remain: "1000",
        total_value: "1000",
        total_asset: "100",
        position_rate: "10",
        position: [
          {
            code: "600000",
            name: "虚构股份",
            market: "17",
            hkmarket: "0",
            price: "10",
            count: "10",
            hold_days: "1",
            cost: "10",
            value: "100",
            hold_profit: "0",
            hold_rate: "0",
            close_profit: "0",
          },
        ],
      },
    ],
    [tzzbEndpoints.trades, { data: [] }],
    [tzzbEndpoints.transfers, { stock: [] }],
    [
      tzzbEndpoints.quotes,
      [{ scdm: "17", zqdm: "600000", xianjia: "10", zuoshou: "10" }],
    ],
  ]);
  const transport: TzzbTransport = {
    async post(path, params) {
      calls.push({ path, params });
      return responses.get(path);
    },
    async close() {},
  };

  const client = new TzzbClient(transport);
  const snapshots = await client.collect({
    capturedAt: new Date("2026-08-05T08:30:00.000Z"),
  });

  assert.equal(snapshots.length, 1);
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      tzzbEndpoints.accounts,
      tzzbEndpoints.positions,
      tzzbEndpoints.trades,
      tzzbEndpoints.transfers,
      tzzbEndpoints.quotes,
    ],
  );
  assert.deepEqual(calls[1]?.params, {
    manual_id: "m-1",
    fund_key: "",
    rzrq_fund_key: "",
    is_merge: "0",
  });
});
