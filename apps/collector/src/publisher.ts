import { z } from "zod";
import type { PortfolioSnapshot } from "@portfolio/domain";

const publishResponseSchema = z.object({
  accepted: z.literal(true),
  snapshotId: z.string(),
  capturedAt: z.string(),
  agentRunId: z.string(),
});

export async function publishSnapshot(
  snapshot: PortfolioSnapshot,
  options: {
    apiUrl: string;
    ingestSharedSecret: string;
    fetch?: typeof globalThis.fetch;
  },
) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const response = await fetcher(new URL("/v1/snapshots", options.apiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.ingestSharedSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) {
    throw new Error(`快照上传失败：HTTP ${response.status}`);
  }
  return publishResponseSchema.parse(await response.json());
}
