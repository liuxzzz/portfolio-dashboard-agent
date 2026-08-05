import { timingSafeEqual } from "node:crypto";
import {
  dashboardPayloadSchema,
  portfolioSnapshotSchema,
  type DashboardPayload,
} from "@portfolio/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  EvidenceFirstAgentService,
  type PortfolioAgentService,
} from "./agent-service.js";
import {
  MemoryPortfolioRepository,
  type PortfolioRepository,
} from "./repository.js";
import { PortfolioIndustryService } from "./industry.js";

export interface AppOptions {
  repository?: PortfolioRepository;
  agentService?: PortfolioAgentService;
  industryService?: PortfolioIndustryService;
  ingestSharedSecret?: string;
  clientOrigin?: string;
  now?: () => Date;
}

const industryOverrideRequestSchema = z.object({
  mainIndustryId: z.string().min(1),
});

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

export function createApp(options: AppOptions = {}) {
  const repository = options.repository ?? new MemoryPortfolioRepository();
  const agentService = options.agentService ?? new EvidenceFirstAgentService();
  const industryService =
    options.industryService ?? new PortfolioIndustryService(repository);
  const now = options.now ?? (() => new Date());
  const expectedSecret =
    options.ingestSharedSecret ?? process.env.INGEST_SHARED_SECRET;
  const app = new Hono();

  app.use(
    "/*",
    cors({
      origin:
        options.clientOrigin ??
        process.env.CLIENT_ORIGIN ??
        process.env.WEB_ORIGIN ??
        "http://localhost:8081",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
      run = await agentService.run(parsed.data, now());
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

    const industry = await industryService.enrich(snapshot);

    const payload: DashboardPayload = {
      snapshot: industry.snapshot,
      industries: industry.industries,
      mainIndustries: industry.mainIndustries,
      industryData: industry.industryData,
      history: await repository.getHistory(snapshot.sourceAccountId, 30),
      latestAgentRun: await repository.getLatestAgentRun(snapshot.id),
    };

    return context.json(dashboardPayloadSchema.parse(payload));
  });

  app.put("/v1/positions/:market/:symbol/main-industry", async (context) => {
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }
    const market = context.req.param("market");
    const symbol = context.req.param("symbol");
    if (
      !snapshot.positions.some(
        (position) => position.market === market && position.symbol === symbol,
      )
    ) {
      return context.json({ error: "position_not_found" }, 404);
    }
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }
    const parsed = industryOverrideRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        { error: "invalid_industry_override", issues: parsed.error.issues },
        400,
      );
    }
    const mainIndustries = await repository.getMainIndustries();
    if (!mainIndustries.some((industry) => industry.id === parsed.data.mainIndustryId)) {
      return context.json({ error: "main_industry_not_found" }, 400);
    }
    const override = await repository.saveIndustryOverride({
      source: snapshot.source,
      sourceAccountId: snapshot.sourceAccountId,
      market,
      symbol,
      mainIndustryId: parsed.data.mainIndustryId,
    });
    return context.json(override);
  });

  app.delete("/v1/positions/:market/:symbol/main-industry", async (context) => {
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }
    const market = context.req.param("market");
    const symbol = context.req.param("symbol");
    if (
      !snapshot.positions.some(
        (position) => position.market === market && position.symbol === symbol,
      )
    ) {
      return context.json({ error: "position_not_found" }, 404);
    }
    await repository.deleteIndustryOverride(
      snapshot.source,
      snapshot.sourceAccountId,
      market,
      symbol,
    );
    return context.json({ restored: true });
  });

  app.post("/v1/industries/refresh", async (context) => {
    if (!expectedSecret) {
      return context.json({ error: "ingest_not_configured" }, 503);
    }
    const receivedSecret = readIngestSecret(
      context.req.header("authorization"),
    );
    if (!secretsMatch(receivedSecret, expectedSecret)) {
      return context.json({ error: "unauthorized" }, 401);
    }
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }
    const industry = await industryService.enrich(snapshot, { force: true });
    return context.json({
      snapshotId: snapshot.id,
      industryCount: industry.industries.filter(
        (allocation) => allocation.name !== "未分类",
      ).length,
      industryData: industry.industryData,
    });
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

  app.post("/v1/agent/runs", async (context) => {
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const run = await agentService.run(snapshot, now());
    await repository.saveAgentRun(run);
    return context.json(run, 201);
  });

  return app;
}
