import { timingSafeEqual } from "node:crypto";
import {
  dashboardPayloadSchema,
  portfolioSnapshotSchema,
  type DashboardPayload,
  type PortfolioSnapshot,
} from "@portfolio/domain";
import { readPortfolioSnapshotFromXlsxBuffer } from "@portfolio/xlsx-import";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  EvidenceFirstAgentService,
  type PortfolioAgentService,
} from "./agent-service.js";
import {
  IndustryTagNameConflictError,
  MemoryPortfolioRepository,
  type PortfolioRepository,
} from "./repository.js";
import { PortfolioIndustryService } from "./industry.js";
import {
  AuthError,
  AuthService,
  maskPhone,
  type AuthUser,
} from "./auth.js";

export interface AppOptions {
  repository?: PortfolioRepository;
  agentService?: PortfolioAgentService;
  industryService?: PortfolioIndustryService;
  authService?: AuthService;
  ingestSharedSecret?: string;
  clientOrigin?: string;
  now?: () => Date;
  xlsxImporter?: XlsxImporter;
}

export type XlsxImporter = (
  contents: Uint8Array,
  options: {
    capturedAt: Date;
    accountId: string;
    accountName: string;
  },
) => Promise<PortfolioSnapshot>;

const MAX_XLSX_UPLOAD_BYTES = 10 * 1024 * 1024;
const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const industryTagAssignmentRequestSchema = z.object({
  tagId: z.string().min(1),
});

const createIndustryTagRequestSchema = z.object({
  name: z.string().trim().min(1).max(20),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const requestSmsCodeSchema = z.object({
  phone: z.string().min(1).max(32),
});

const createSessionSchema = z.object({
  phone: z.string().min(1).max(32),
  code: z.string().regex(/^\d{6}$/),
});

const xlsxImportMetadataSchema = z.object({
  accountId: z.string().trim().min(1).max(128).default("xlsx-upload"),
  accountName: z.string().trim().min(1).max(100).default("Excel 上传组合"),
  capturedAt: z.iso.datetime().optional(),
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

function readBearerToken(authorization: string | undefined) {
  const prefix = "Bearer ";
  return authorization?.startsWith(prefix)
    ? authorization.slice(prefix.length)
    : undefined;
}

function publicUser(user: AuthUser) {
  return { id: user.id, phone: maskPhone(user.phone) };
}

export function createApp(options: AppOptions = {}) {
  const repository = options.repository ?? new MemoryPortfolioRepository();
  const agentService = options.agentService ?? new EvidenceFirstAgentService();
  const industryService =
    options.industryService ?? new PortfolioIndustryService(repository);
  const now = options.now ?? (() => new Date());
  const authService = options.authService;
  const expectedSecret =
    options.ingestSharedSecret ?? process.env.INGEST_SHARED_SECRET;
  const xlsxImporter =
    options.xlsxImporter ?? readPortfolioSnapshotFromXlsxBuffer;
  const app = new Hono<{ Variables: { user: AuthUser; accessToken: string } }>();

  const saveUserSnapshot = async (
    userId: string,
    snapshot: PortfolioSnapshot,
  ) => {
    const saveResult = await repository.saveSnapshot(userId, snapshot);
    let run = await repository.getLatestAgentRun(userId, snapshot.id);
    if (saveResult === "created" || !run) {
      run = await agentService.run(snapshot, now());
      await repository.saveAgentRun(userId, run);
    }
    return { saveResult, run };
  };

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

  app.use("/v1/*", async (context, next) => {
    const path = context.req.path;
    if (
      path === "/v1/snapshots" ||
      path === "/v1/auth/sms-codes" ||
      path === "/v1/auth/sessions"
    ) {
      return next();
    }
    if (!authService) {
      return context.json({ error: "auth_not_configured" }, 503);
    }
    const accessToken = readBearerToken(
      context.req.header("authorization"),
    );
    const user = await authService.authenticate(accessToken);
    if (!user || !accessToken) {
      return context.json({ error: "unauthorized" }, 401);
    }
    context.set("user", user);
    context.set("accessToken", accessToken);
    return next();
  });

  app.post("/v1/auth/sms-codes", async (context) => {
    if (!authService) return context.json({ error: "auth_not_configured" }, 503);
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }
    const parsed = requestSmsCodeSchema.safeParse(payload);
    if (!parsed.success) return context.json({ error: "invalid_phone" }, 400);
    try {
      const result = await authService.sendCode(parsed.data.phone);
      return context.json(result, 202);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      if (error.retryAfterSeconds) {
        context.header("Retry-After", String(error.retryAfterSeconds));
      }
      return context.json(
        {
          error: error.code,
          ...(error.retryAfterSeconds
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : {}),
        },
        error.status,
      );
    }
  });

  app.post("/v1/auth/sessions", async (context) => {
    if (!authService) return context.json({ error: "auth_not_configured" }, 503);
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }
    const parsed = createSessionSchema.safeParse(payload);
    if (!parsed.success) return context.json({ error: "invalid_credentials" }, 400);
    try {
      const session = await authService.createSession(
        parsed.data.phone,
        parsed.data.code,
      );
      return context.json({ ...session, user: publicUser(session.user) }, 201);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      return context.json({ error: error.code }, error.status);
    }
  });

  app.get("/v1/auth/me", (context) => {
    return context.json({ user: publicUser(context.get("user")) });
  });

  app.delete("/v1/auth/session", async (context) => {
    await authService?.logout(context.get("accessToken"));
    return context.json({ loggedOut: true });
  });

  app.post("/v1/snapshots", async (context) => {
    if (!expectedSecret) {
      return context.json({ error: "ingest_not_configured" }, 503);
    }

    const receivedSecret = readBearerToken(
      context.req.header("authorization"),
    );
    if (!secretsMatch(receivedSecret, expectedSecret)) {
      return context.json({ error: "unauthorized" }, 401);
    }

    if (!authService) return context.json({ error: "auth_not_configured" }, 503);
    const targetPhone = context.req.header("x-portfolio-user");
    if (!targetPhone) {
      return context.json({ error: "ingest_user_required" }, 400);
    }
    let targetUser: AuthUser | null;
    try {
      targetUser = await authService.getUserByPhone(targetPhone);
    } catch (error) {
      if (error instanceof AuthError) {
        return context.json({ error: "invalid_ingest_user" }, 400);
      }
      throw error;
    }
    if (!targetUser) {
      return context.json({ error: "ingest_user_not_found" }, 409);
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

    const { run } = await saveUserSnapshot(targetUser.id, parsed.data);

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

  app.post(
    "/v1/imports/xlsx",
    bodyLimit({
      maxSize: MAX_XLSX_UPLOAD_BYTES + 64 * 1024,
      onError: (context) =>
        context.json(
          {
            error: "xlsx_too_large",
            maxBytes: MAX_XLSX_UPLOAD_BYTES,
          },
          413,
        ),
    }),
    async (context) => {
      if (!context.req.header("content-type")?.includes("multipart/form-data")) {
        return context.json({ error: "multipart_form_data_required" }, 415);
      }

      let body: Awaited<ReturnType<typeof context.req.parseBody>>;
      try {
        body = await context.req.parseBody();
      } catch {
        return context.json({ error: "invalid_multipart_body" }, 400);
      }

      const file = body.file;
      if (!file || typeof file === "string") {
        return context.json({ error: "xlsx_file_required" }, 400);
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        return context.json({ error: "xlsx_file_required" }, 415);
      }
      if (file.type && file.type !== XLSX_CONTENT_TYPE) {
        return context.json({ error: "unsupported_xlsx_content_type" }, 415);
      }
      if (file.size === 0) {
        return context.json({ error: "xlsx_file_empty" }, 400);
      }
      if (file.size > MAX_XLSX_UPLOAD_BYTES) {
        return context.json(
          { error: "xlsx_too_large", maxBytes: MAX_XLSX_UPLOAD_BYTES },
          413,
        );
      }

      const metadata = xlsxImportMetadataSchema.safeParse({
        accountId:
          typeof body.accountId === "string" ? body.accountId : undefined,
        accountName:
          typeof body.accountName === "string" ? body.accountName : undefined,
        capturedAt:
          typeof body.capturedAt === "string" ? body.capturedAt : undefined,
      });
      if (!metadata.success) {
        return context.json(
          { error: "invalid_xlsx_metadata", issues: metadata.error.issues },
          400,
        );
      }

      let snapshot: PortfolioSnapshot;
      try {
        snapshot = await xlsxImporter(
          new Uint8Array(await file.arrayBuffer()),
          {
            capturedAt: metadata.data.capturedAt
              ? new Date(metadata.data.capturedAt)
              : now(),
            accountId: metadata.data.accountId,
            accountName: metadata.data.accountName,
          },
        );
      } catch (error) {
        return context.json(
          {
            error: "invalid_xlsx",
            message:
              error instanceof Error ? error.message : "无法解析 XLSX 文件",
          },
          400,
        );
      }

      const userId = context.get("user").id;
      const { saveResult, run } = await saveUserSnapshot(userId, snapshot);
      return context.json(
        {
          imported: true,
          duplicate: saveResult === "existing",
          snapshotId: snapshot.id,
          capturedAt: snapshot.capturedAt,
          positionCount: snapshot.positions.length,
          agentRunId: run.id,
        },
        saveResult === "created" ? 201 : 200,
      );
    },
  );

  app.get("/v1/dashboard", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);

    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const industry = await industryService.enrich(userId, snapshot);

    const payload: DashboardPayload = {
      snapshot: industry.snapshot,
      industries: industry.industries,
      industryTags: industry.industryTags,
      industryData: industry.industryData,
      history: await repository.getHistory(userId, snapshot.sourceAccountId, 30),
      latestAgentRun: await repository.getLatestAgentRun(userId, snapshot.id),
    };

    return context.json(dashboardPayloadSchema.parse(payload));
  });

  app.get("/v1/industry-tags", async (context) => {
    return context.json(await repository.getIndustryTags(context.get("user").id));
  });

  app.post("/v1/industry-tags", async (context) => {
    const userId = context.get("user").id;
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "invalid_json" }, 400);
    }
    const parsed = createIndustryTagRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        { error: "invalid_industry_tag", issues: parsed.error.issues },
        400,
      );
    }
    if ((await repository.getIndustryTags(userId)).length >= 30) {
      return context.json({ error: "industry_tag_limit_reached" }, 400);
    }
    try {
      const tag = await repository.createIndustryTag(userId, {
        name: parsed.data.name,
        color: parsed.data.color.toUpperCase(),
      });
      return context.json(tag, 201);
    } catch (error) {
      if (error instanceof IndustryTagNameConflictError) {
        return context.json({ error: "industry_tag_name_exists" }, 409);
      }
      throw error;
    }
  });

  app.delete("/v1/industry-tags/:tagId", async (context) => {
    const deleted = await repository.deleteIndustryTag(
      context.get("user").id,
      context.req.param("tagId"),
    );
    if (!deleted) return context.json({ error: "industry_tag_not_found" }, 404);
    return context.json({ deleted: true });
  });

  app.put("/v1/positions/:market/:symbol/industry-tag", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);
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
    const parsed = industryTagAssignmentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        { error: "invalid_industry_tag_assignment", issues: parsed.error.issues },
        400,
      );
    }
    const tags = await repository.getIndustryTags(userId);
    if (!tags.some((tag) => tag.id === parsed.data.tagId)) {
      return context.json({ error: "industry_tag_not_found" }, 400);
    }
    const assignment = await repository.saveIndustryTagAssignment({
      userId,
      source: snapshot.source,
      sourceAccountId: snapshot.sourceAccountId,
      market,
      symbol,
      tagId: parsed.data.tagId,
    });
    return context.json(assignment);
  });

  app.delete("/v1/positions/:market/:symbol/industry-tag", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);
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
    await repository.deleteIndustryTagAssignment(
      userId,
      snapshot.source,
      snapshot.sourceAccountId,
      market,
      symbol,
    );
    return context.json({ restored: true });
  });

  app.post("/v1/industries/refresh", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }
    const industry = await industryService.enrich(userId, snapshot, { force: true });
    return context.json({
      snapshotId: snapshot.id,
      industryCount: industry.industries.filter(
        (allocation) => allocation.name !== "未分类",
      ).length,
      industryData: industry.industryData,
    });
  });

  app.get("/v1/agent/runs/latest", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const run = await repository.getLatestAgentRun(userId, snapshot.id);
    if (!run) {
      return context.json({ error: "agent_run_not_found" }, 404);
    }

    return context.json(run);
  });

  app.post("/v1/agent/runs", async (context) => {
    const userId = context.get("user").id;
    const accountId = context.req.query("accountId");
    const snapshot = await repository.getLatestSnapshot(userId, accountId);
    if (!snapshot) {
      return context.json({ error: "snapshot_not_found" }, 404);
    }

    const run = await agentService.run(snapshot, now());
    await repository.saveAgentRun(userId, run);
    return context.json(run, 201);
  });

  return app;
}
