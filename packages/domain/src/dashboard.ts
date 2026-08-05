import { z } from "zod";
import { agentRunSchema } from "./agent";
import {
  industryAllocationSchema,
  industryDataStatusSchema,
  portfolioHistoryPointSchema,
  portfolioSnapshotSchema,
} from "./portfolio";

export const dashboardPayloadSchema = z.object({
  snapshot: portfolioSnapshotSchema,
  industries: z.array(industryAllocationSchema),
  industryData: industryDataStatusSchema.optional(),
  history: z.array(portfolioHistoryPointSchema),
  latestAgentRun: agentRunSchema.nullable(),
});

export type DashboardPayload = z.infer<typeof dashboardPayloadSchema>;
