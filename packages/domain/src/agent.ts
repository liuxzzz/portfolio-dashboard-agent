import { z } from "zod";

export const agentRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const insightSeveritySchema = z.enum(["info", "attention", "risk"]);

export const evidenceReferenceSchema = z.object({
  kind: z.enum(["snapshot", "position", "calculation", "market"]),
  referenceId: z.string().min(1),
  label: z.string().min(1),
  asOf: z.iso.datetime(),
});

export const agentInsightSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["freshness", "concentration", "cash", "change", "note"]),
  severity: insightSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceReferenceSchema).min(1),
  createdAt: z.iso.datetime(),
});

export const agentRunSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  status: agentRunStatusSchema,
  requestedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  model: z.string().nullable(),
  insights: z.array(agentInsightSchema),
  disclaimer: z.string().min(1),
});

export const agentToolCallSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  toolName: z.string().min(1),
  status: z.enum(["requested", "succeeded", "failed"]),
  inputHash: z.string().min(1),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type InsightSeverity = z.infer<typeof insightSeveritySchema>;
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
export type AgentInsight = z.infer<typeof agentInsightSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;

