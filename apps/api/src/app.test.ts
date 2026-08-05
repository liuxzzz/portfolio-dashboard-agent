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
    accessSharedSecret: "test-access-secret",
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });
  const accessHeaders = { Authorization: "Bearer test-access-secret" };

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

  const unauthorizedDashboard = await app.request("/v1/dashboard");
  assert.equal(unauthorizedDashboard.status, 401);

  const dashboard = await app.request("/v1/dashboard", {
    headers: accessHeaders,
  });
  assert.equal(dashboard.status, 200);
  const payload = (await dashboard.json()) as {
    snapshot: { id: string; positions: Array<{ industry: string }> };
    industries: Array<{ name: string; weight: number }>;
    mainIndustries: Array<{ id: string; name: string }>;
    latestAgentRun: { status: string };
  };
  assert.equal(payload.snapshot.id, snapshot.id);
  assert.deepEqual(payload.industries[0], {
    name: "金融",
    code: null,
    value: 80_000,
    weight: 0.8,
    dayRate: null,
    color: "#172033",
  });
  assert.equal(payload.latestAgentRun.status, "completed");
  assert.deepEqual(
    payload.mainIndustries.map((industry) => industry.name),
    ["半导体", "互联网", "智能驾驶", "商业航天", "医药", "银行"],
  );

  const customized = await app.request(
    "/v1/positions/SH/600000/main-industry",
    {
      method: "PUT",
      headers: {
        ...accessHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mainIndustryId: "banking" }),
    },
  );
  assert.equal(customized.status, 200);
  const customizedDashboard = await app.request("/v1/dashboard", {
    headers: accessHeaders,
  });
  const customizedPayload = (await customizedDashboard.json()) as {
    snapshot: {
      positions: Array<{
        industry: string;
        sourceIndustry: string;
        mainIndustryId: string;
        industryCustomized: boolean;
      }>;
    };
    industries: Array<{ name: string; color: string }>;
  };
  assert.deepEqual(customizedPayload.snapshot.positions[0], {
    ...customizedPayload.snapshot.positions[0],
    industry: "银行",
    sourceIndustry: "金融",
    mainIndustryId: "banking",
    industryCustomized: true,
  });
  assert.equal(customizedPayload.industries[0]?.name, "银行");
  assert.equal(customizedPayload.industries[0]?.color, "#8B98A9");

  const restored = await app.request(
    "/v1/positions/SH/600000/main-industry",
    { method: "DELETE", headers: accessHeaders },
  );
  assert.equal(restored.status, 200);
  const restoredDashboard = await app.request("/v1/dashboard", {
    headers: accessHeaders,
  });
  const restoredPayload = (await restoredDashboard.json()) as {
    snapshot: { positions: Array<{ industry: string; industryCustomized: boolean }> };
  };
  assert.equal(restoredPayload.snapshot.positions[0]?.industry, "金融");
  assert.equal(restoredPayload.snapshot.positions[0]?.industryCustomized, false);

  const rerun = await app.request("/v1/agent/runs", {
    method: "POST",
    headers: accessHeaders,
  });
  assert.equal(rerun.status, 201);
  const rerunPayload = (await rerun.json()) as {
    snapshotId: string;
    status: string;
    insights: unknown[];
  };
  assert.equal(rerunPayload.snapshotId, snapshot.id);
  assert.equal(rerunPayload.status, "completed");
  assert.ok(rerunPayload.insights.length > 0);

  const refreshed = await app.request("/v1/industries/refresh", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });
  assert.equal(refreshed.status, 200);
  const refreshedPayload = (await refreshed.json()) as {
    industryData: { status: string };
  };
  assert.equal(refreshedPayload.industryData.status, "disabled");
});

test("manual Agent run requires an existing snapshot", async () => {
  const app = createApp({
    ingestSharedSecret: "test-secret",
    accessSharedSecret: "test-access-secret",
  });
  const response = await app.request("/v1/agent/runs", {
    method: "POST",
    headers: { Authorization: "Bearer test-access-secret" },
  });
  assert.equal(response.status, 404);
});
