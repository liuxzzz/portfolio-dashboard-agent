import { z } from "zod";
import { agentRunSchema } from "./agent";
import {
  industryAllocationSchema,
  industryDataStatusSchema,
  mainIndustrySchema,
  portfolioHistoryPointSchema,
  portfolioSnapshotSchema,
} from "./portfolio";

export const dashboardPayloadSchema = z.object({
  snapshot: portfolioSnapshotSchema,
  industries: z.array(industryAllocationSchema),
  mainIndustries: z.array(mainIndustrySchema),
  industryData: industryDataStatusSchema.optional(),
  history: z.array(portfolioHistoryPointSchema),
  latestAgentRun: agentRunSchema.nullable(),
});

export type DashboardPayload = z.infer<typeof dashboardPayloadSchema>;
