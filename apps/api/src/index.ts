import { serve } from "@hono/node-server";
import { portfolioSnapshotSchema } from "@portfolio/domain";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (context) =>
  context.json({ service: "portfolio-api", status: "ok" }),
);

app.post("/v1/snapshots", async (context) => {
  const payload: unknown = await context.req.json();
  const parsed = portfolioSnapshotSchema.safeParse(payload);

  if (!parsed.success) {
    return context.json(
      { error: "invalid_snapshot", issues: parsed.error.issues },
      400,
    );
  }

  // Persistence and authentication intentionally land in the next milestone.
  return context.json({ accepted: true, capturedAt: parsed.data.capturedAt }, 202);
});

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`portfolio-api listening on http://localhost:${info.port}`);
});

