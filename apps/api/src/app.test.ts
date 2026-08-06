import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot } from "@portfolio/domain";
import { createApp } from "./app.js";
import {
  AuthService,
  MemoryAuthStore,
  type SmsSender,
} from "./auth.js";

class TestSmsSender implements SmsSender {
  readonly codes = new Map<string, string>();

  async sendVerificationCode(phone: string, code: string) {
    this.codes.set(phone, code);
  }
}

function testAuth(now = () => new Date("2026-08-05T09:00:00.000Z")) {
  const sms = new TestSmsSender();
  return {
    sms,
    service: new AuthService(
      new MemoryAuthStore(),
      sms,
      "test-auth-secret-that-is-at-least-32-characters",
      { now, generateCode: () => "123456" },
    ),
  };
}

async function login(app: ReturnType<typeof createApp>, phone = "13800138000") {
  const requested = await app.request("/v1/auth/sms-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  assert.equal(requested.status, 202);
  const response = await app.request("/v1/auth/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: "123456" }),
  });
  assert.equal(response.status, 201);
  const session = (await response.json()) as { accessToken: string };
  return session.accessToken;
}

function xlsxForm(
  options: {
    name?: string;
    type?: string;
    accountId?: string;
    accountName?: string;
    capturedAt?: string;
  } = {},
) {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array([80, 75, 3, 4])], options.name ?? "持仓.xlsx", {
      type:
        options.type ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  if (options.accountId) form.set("accountId", options.accountId);
  if (options.accountName) form.set("accountName", options.accountName);
  if (options.capturedAt) form.set("capturedAt", options.capturedAt);
  return form;
}

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
  const auth = testAuth();
  const app = createApp({
    ingestSharedSecret: "test-secret",
    authService: auth.service,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });
  const accessToken = await login(app);
  const accessHeaders = { Authorization: `Bearer ${accessToken}` };

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
      "X-Portfolio-User": "13800138000",
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
      "X-Portfolio-User": "13800138000",
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
    industryTags: Array<{ id: string; name: string }>;
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
  assert.deepEqual(payload.industryTags, []);

  const createdTag = await app.request("/v1/industry-tags", {
    method: "POST",
    headers: { ...accessHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "银行", color: "#8B98A9" }),
  });
  assert.equal(createdTag.status, 201);
  const tag = (await createdTag.json()) as { id: string; name: string; color: string };
  assert.equal(tag.name, "银行");

  const duplicateTag = await app.request("/v1/industry-tags", {
    method: "POST",
    headers: { ...accessHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "银行", color: "#3E6FCA" }),
  });
  assert.equal(duplicateTag.status, 409);

  const customized = await app.request(
    "/v1/positions/SH/600000/industry-tag",
    {
      method: "PUT",
      headers: {
        ...accessHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tagId: tag.id }),
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
        industryTagId: string;
        industryTagged: boolean;
      }>;
    };
    industries: Array<{ name: string; color: string }>;
  };
  assert.deepEqual(customizedPayload.snapshot.positions[0], {
    ...customizedPayload.snapshot.positions[0],
    industry: "银行",
    sourceIndustry: "金融",
    industryTagId: tag.id,
    industryTagged: true,
  });
  assert.equal(customizedPayload.industries[0]?.name, "银行");
  assert.equal(customizedPayload.industries[0]?.color, "#8B98A9");

  const restored = await app.request(
    "/v1/positions/SH/600000/industry-tag",
    { method: "DELETE", headers: accessHeaders },
  );
  assert.equal(restored.status, 200);
  const restoredDashboard = await app.request("/v1/dashboard", {
    headers: accessHeaders,
  });
  const restoredPayload = (await restoredDashboard.json()) as {
    snapshot: { positions: Array<{ industry: string; industryTagged: boolean }> };
  };
  assert.equal(restoredPayload.snapshot.positions[0]?.industry, "金融");
  assert.equal(restoredPayload.snapshot.positions[0]?.industryTagged, false);

  const reassigned = await app.request(
    "/v1/positions/SH/600000/industry-tag",
    {
      method: "PUT",
      headers: { ...accessHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    },
  );
  assert.equal(reassigned.status, 200);

  const deletedTag = await app.request(`/v1/industry-tags/${tag.id}`, {
    method: "DELETE",
    headers: accessHeaders,
  });
  assert.equal(deletedTag.status, 200);
  const tagsAfterDelete = await app.request("/v1/industry-tags", {
    headers: accessHeaders,
  });
  assert.deepEqual(await tagsAfterDelete.json(), []);
  const dashboardAfterTagDelete = await app.request("/v1/dashboard", {
    headers: accessHeaders,
  });
  const afterTagDeletePayload = (await dashboardAfterTagDelete.json()) as {
    snapshot: { positions: Array<{ industry: string; industryTagged: boolean }> };
  };
  assert.equal(afterTagDeletePayload.snapshot.positions[0]?.industry, "金融");
  assert.equal(afterTagDeletePayload.snapshot.positions[0]?.industryTagged, false);

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
    headers: accessHeaders,
  });
  assert.equal(refreshed.status, 200);
  const refreshedPayload = (await refreshed.json()) as {
    industryData: { status: string };
  };
  assert.equal(refreshedPayload.industryData.status, "disabled");
});

test("manual Agent run requires an existing snapshot", async () => {
  const auth = testAuth();
  const app = createApp({
    ingestSharedSecret: "test-secret",
    authService: auth.service,
  });
  const accessToken = await login(app);
  const response = await app.request("/v1/agent/runs", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(response.status, 404);

  const tag = await app.request("/v1/industry-tags", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "采集前标签", color: "#5BC5A7" }),
  });
  assert.equal(tag.status, 201);
  const tags = await app.request("/v1/industry-tags", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(((await tags.json()) as unknown[]).length, 1);
});

test("isolates snapshots and sessions between phone users", async () => {
  const auth = testAuth();
  const app = createApp({
    ingestSharedSecret: "test-secret",
    authService: auth.service,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
  });
  const firstToken = await login(app, "13800138000");
  const secondToken = await login(app, "13900139000");

  const uploaded = await app.request("/v1/snapshots", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-secret",
      "X-Portfolio-User": "13800138000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  assert.equal(uploaded.status, 202);

  const ownerDashboard = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(ownerDashboard.status, 200);
  const otherDashboard = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  assert.equal(otherDashboard.status, 404);

  const ownerTag = await app.request("/v1/industry-tags", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${firstToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "我的银行股", color: "#3E6FCA" }),
  });
  assert.equal(ownerTag.status, 201);
  const ownerTagPayload = (await ownerTag.json()) as { id: string };
  const otherTags = await app.request("/v1/industry-tags", {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  assert.deepEqual(await otherTags.json(), []);
  const otherDelete = await app.request(
    `/v1/industry-tags/${ownerTagPayload.id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secondToken}` },
    },
  );
  assert.equal(otherDelete.status, 404);
  const ownerTags = await app.request("/v1/industry-tags", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(((await ownerTags.json()) as unknown[]).length, 1);

  const logout = await app.request("/v1/auth/session", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(logout.status, 200);
  const afterLogout = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(afterLogout.status, 401);
});

test("imports XLSX into the authenticated user without trusting a target user", async () => {
  const auth = testAuth();
  const importedAt = "2026-08-05T08:45:00.000Z";
  const importCalls: Array<{
    bytes: number;
    accountId: string;
    accountName: string;
    capturedAt: string;
  }> = [];
  const app = createApp({
    authService: auth.service,
    now: () => new Date("2026-08-05T09:00:00.000Z"),
    xlsxImporter: async (contents, options) => {
      importCalls.push({
        bytes: contents.byteLength,
        accountId: options.accountId,
        accountName: options.accountName,
        capturedAt: options.capturedAt.toISOString(),
      });
      return {
        ...snapshot,
        id: "snapshot-xlsx-user-isolation",
        sourceAccountId: options.accountId,
        accountName: options.accountName,
        capturedAt: options.capturedAt.toISOString(),
      };
    },
  });
  const firstToken = await login(app, "13800138000");
  const secondToken = await login(app, "13900139000");

  const unauthorized = await app.request("/v1/imports/xlsx", {
    method: "POST",
    body: xlsxForm(),
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(importCalls.length, 0);

  const firstForm = xlsxForm({
    accountId: "my-export",
    accountName: "我的导入组合",
    capturedAt: importedAt,
  });
  firstForm.set("userId", "forged-user-id");
  firstForm.set("phone", "13900139000");
  const firstUpload = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers: { Authorization: `Bearer ${firstToken}` },
    body: firstForm,
  });
  assert.equal(firstUpload.status, 201);
  assert.deepEqual(await firstUpload.json(), {
    imported: true,
    duplicate: false,
    snapshotId: "snapshot-xlsx-user-isolation",
    capturedAt: importedAt,
    positionCount: 1,
    agentRunId: "run:snapshot-xlsx-user-isolation:1785920400000",
  });
  assert.deepEqual(importCalls[0], {
    bytes: 4,
    accountId: "my-export",
    accountName: "我的导入组合",
    capturedAt: importedAt,
  });

  const firstDashboard = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${firstToken}` },
  });
  assert.equal(firstDashboard.status, 200);
  const secondDashboardBeforeImport = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  assert.equal(secondDashboardBeforeImport.status, 404);

  const duplicate = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers: { Authorization: `Bearer ${firstToken}` },
    body: xlsxForm({
      accountId: "my-export",
      accountName: "我的导入组合",
      capturedAt: importedAt,
    }),
  });
  assert.equal(duplicate.status, 200);
  assert.equal(
    ((await duplicate.json()) as { duplicate: boolean }).duplicate,
    true,
  );

  const secondUpload = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers: { Authorization: `Bearer ${secondToken}` },
    body: xlsxForm({
      accountId: "my-export",
      accountName: "我的导入组合",
      capturedAt: importedAt,
    }),
  });
  assert.equal(secondUpload.status, 201);
  const secondDashboardAfterImport = await app.request("/v1/dashboard", {
    headers: { Authorization: `Bearer ${secondToken}` },
  });
  assert.equal(secondDashboardAfterImport.status, 200);
});

test("validates XLSX upload files and parser failures", async () => {
  const auth = testAuth();
  const app = createApp({
    authService: auth.service,
    xlsxImporter: async () => {
      throw new Error("导出文件缺少持仓数据工作表");
    },
  });
  const token = await login(app);
  const headers = { Authorization: `Bearer ${token}` };

  const missingForm = new FormData();
  const missing = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers,
    body: missingForm,
  });
  assert.equal(missing.status, 400);
  assert.deepEqual(await missing.json(), { error: "xlsx_file_required" });

  const unsupported = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers,
    body: xlsxForm({ name: "持仓.csv", type: "text/csv" }),
  });
  assert.equal(unsupported.status, 415);

  const invalid = await app.request("/v1/imports/xlsx", {
    method: "POST",
    headers,
    body: xlsxForm(),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: "invalid_xlsx",
    message: "导出文件缺少持仓数据工作表",
  });
});
