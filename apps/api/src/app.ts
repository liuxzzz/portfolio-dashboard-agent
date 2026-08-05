import { timingSafeEqual } from "node:crypto";
import { analyzePortfolio } from "@portfolio/agent-core";
import {
  dashboardPayloadSchema,
  portfolioSnapshotSchema,
  type DashboardPayload,
  type IndustryAllocation,
  type PortfolioSnapshot,
} from "@portfolio/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  MemoryPortfolioRepository,
  type PortfolioRepository,
} from "./repository.js";

const industryColors = [
  "#172033",
  "#5BC5A7",
  "#F3B45A",
  "#7C8BE8",
  "#D96C8B",
  "#8B98A9",
];

export interface AppOptions {
  repository?: PortfolioRepository;
  ingestSharedSecret?: string;
  webOrigin?: string;
  now?: () => Date;
}

function secretsMatch(received: string | undefined, expected: string | undefined) {
  if (!received || !expected) {
    return false;
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function readIngestSecret(authorization: string | undefined) {
  const prefix = "Bearer ";
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : undefined;
}

function aggregateIndustries(snapshot: PortfolioSnapshot): IndustryAllocation[] {
  const totals = new Map<string, number>();

  for (const position of snapshot.positions) {
    const industry = position.industry ?? "未分类";
    totals.set(industry, (totals.get(industry) ?? 0) + position.marketValue);
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([name, value], index) => ({
      name,
      value,
      weight: snapshot.totalAsset === 0 ? 0 : value / snapshot.totalAsset,
      color: industryColors[index % industryColors.length] ?? "#8B98A9",
    }));
}

export function createApp(options: AppOptions = {}) {
  const repository = options.repository ?? new MemoryPortfolioRepository();
  const now = options.now ?? (() => new Date());
  const expectedSecret =
    options.ingestSharedSecret ?? process.env.INGEST_SHARED_SECRET;
  const app = new Hono();

  app.use(
    "/*",
    cors({
      origin:
        options.webOrigin ??
        process.env.WEB_ORIGIN ??
        "http://localhost:8081",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/health", async (context) => {
    try {
      await repository.healthCheck();
      return context.json({ service: "portfolio-api", status: "ok" });
    } catch {
      return context.json(
        { service: "portfolio-api", status: "unavailable" },
        503,
      );
    }
  });

  app.post("/v1/snapshots", async (context) => {
    if (!expectedSecret) {
      return context.json({ error: "ingest_not_configured" }, 503);
    }

    const receivedSecret = readIngestSecret(
      context.req.header("authorization"),
    );
    if (!secretsMatch(receivedSecret, expectedSecret)) {
      return context.json({ error: "unauthorized" }, 401);
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }

    const parsed = portfolioSnapshotSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        { error: "invalid_snapshot", issues: parsed.error.issues },
        400,
      );
    }

    const saveResult = await repository.saveSnapshot(parsed.data);
    let run = await repository.getLatestAgentRun(parsed.data.id);
    if (saveResult === "created" || !run) {
      run = analyzePortfolio(parsed.data, now());
      await repository.saveAgentRun(run);
    }

    return context.json(
      {
        accepted: true,
        snapshotId: parsed.data.id,
        capturedAt: parsed.data.capturedAt,
        agentRunId: run.id,
      },
      202,
    );
  });

  app.get("/v1/dashboard", async (context) => {
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);

    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const payload: DashboardPayload = {
      snapshot,
      industries: aggregateIndustries(snapshot),
      history: await repository.getHistory(snapshot.sourceAccountId, 30),
      latestAgentRun: await repository.getLatestAgentRun(snapshot.id),
    };

    return context.json(dashboardPayloadSchema.parse(payload));
  });

  app.get("/v1/agent/runs/latest", async (context) => {
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const run = await repository.getLatestAgentRun(snapshot.id);
    if (!run) {
      return context.json({ error: "agent_run_not_found" }, 404);
    }

    return context.json(run);
  });

  return app;
}
