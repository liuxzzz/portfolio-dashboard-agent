import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot } from "@portfolio/domain";
import { createApp } from "./app.js";

const snapshot: PortfolioSnapshot = {
  id: "snapshot-api-test",
  source: "tzzb",
  sourceAccountId: "account-api-test",
  accountName: "接口测试账户",
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
      name: "示例股份",
      market: "SH",
      industry: "金融",
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

test("accepts an authenticated snapshot and serves a dashboard", async () => {
  const app = createApp({
    ingestSharedSecret: "test-secret",
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });

  const unauthorized = await app.request("/v1/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  assert.equal(unauthorized.status, 401);

  const accepted = await app.request("/v1/snapshots", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  assert.equal(accepted.status, 202);
  const acceptedPayload = (await accepted.json()) as { agentRunId: string };

  const retried = await app.request("/v1/snapshots", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-secret",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  assert.equal(retried.status, 202);
  const retriedPayload = (await retried.json()) as { agentRunId: string };
  assert.equal(retriedPayload.agentRunId, acceptedPayload.agentRunId);

  const dashboard = await app.request("/v1/dashboard");
  assert.equal(dashboard.status, 200);
  const payload = (await dashboard.json()) as {
    snapshot: { id: string };
    industries: Array<{ name: string; weight: number }>;
    latestAgentRun: { status: string };
  };
  assert.equal(payload.snapshot.id, snapshot.id);
  assert.deepEqual(payload.industries[0], {
    name: "金融",
    value: 80_000,
    weight: 0.8,
    color: "#172033",
  });
  assert.equal(payload.latestAgentRun.status, "completed");

  const rerun = await app.request("/v1/agent/runs", { method: "POST" });
  assert.equal(rerun.status, 201);
  const rerunPayload = (await rerun.json()) as {
    snapshotId: string;
    status: string;
    insights: unknown[];
  };
  assert.equal(rerunPayload.snapshotId, snapshot.id);
  assert.equal(rerunPayload.status, "completed");
  assert.ok(rerunPayload.insights.length > 0);
});

test("manual Agent run requires an existing snapshot", async () => {
  const app = createApp({ ingestSharedSecret: "test-secret" });
  const response = await app.request("/v1/agent/runs", { method: "POST" });
  assert.equal(response.status, 404);
});
