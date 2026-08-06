import { z } from "zod";
import { agentRunSchema } from "./agent";
import {
  industryAllocationSchema,
  industryDataStatusSchema,
  industryTagSchema,
  portfolioHistoryPointSchema,
  portfolioSnapshotSchema,
} from "./portfolio";

export const dashboardPayloadSchema = z.object({
  snapshot: portfolioSnapshotSchema,
  industries: z.array(industryAllocationSchema),
  industryTags: z.array(industryTagSchema),
  industryData: industryDataStatusSchema.optional(),
  history: z.array(portfolioHistoryPointSchema),
  latestAgentRun: agentRunSchema.nullable(),
});

export type DashboardPayload = z.infer<typeof dashboardPayloadSchema>;
