import { z } from "zod";
import { agentRunSchema } from "./agent";
import {
  industryAllocationSchema,
  portfolioHistoryPointSchema,
  portfolioSnapshotSchema,
} from "./portfolio";

export const dashboardPayloadSchema = z.object({
  snapshot: portfolioSnapshotSchema,
  industries: z.array(industryAllocationSchema),
  history: z.array(portfolioHistoryPointSchema),
  latestAgentRun: agentRunSchema.nullable(),
});

export type DashboardPayload = z.infer<typeof dashboardPayloadSchema>;
