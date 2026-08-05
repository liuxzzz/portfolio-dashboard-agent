import { z } from "zod";

export const dataFreshnessSchema = z.enum(["fresh", "stale", "unknown"]);

export const mainIndustrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});

export const defaultMainIndustries = [
  { id: "semiconductor", name: "半导体", color: "#3E6FCA", sortOrder: 0 },
  { id: "internet", name: "互联网", color: "#5BC5A7", sortOrder: 1 },
  { id: "smart-driving", name: "智能驾驶", color: "#F3B45A", sortOrder: 2 },
  { id: "commercial-space", name: "商业航天", color: "#7C8BE8", sortOrder: 3 },
  { id: "healthcare", name: "医药", color: "#D96C8B", sortOrder: 4 },
  { id: "banking", name: "银行", color: "#8B98A9", sortOrder: 5 },
] as const;

export const positionSnapshotSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  market: z.string().min(1),
  industry: z.string().nullable(),
  sourceIndustry: z.string().nullable().optional(),
  mainIndustryId: z.string().nullable().optional(),
  industryCustomized: z.boolean().optional(),
  quantity: z.number(),
  currentPrice: z.number().nullable(),
  unitCost: z.number().nullable(),
  marketValue: z.number(),
  portfolioWeight: z.number().nullable(),
  dayProfit: z.number().nullable(),
  dayProfitRate: z.number().nullable(),
  holdingProfit: z.number().nullable(),
  holdingProfitRate: z.number().nullable(),
  holdingDays: z.number().int().nonnegative().nullable(),
  latestRate: z.number().nullable().optional(),
  relatedSector: z.string().nullable().optional(),
  sectorRate: z.number().nullable().optional(),
  combinationProfit: z.number().nullable().optional(),
  combinationRate: z.number().nullable().optional(),
  cumulativeProfit: z.number().nullable().optional(),
  cumulativeProfitRate: z.number().nullable().optional(),
  weekProfit: z.number().nullable().optional(),
  monthProfit: z.number().nullable().optional(),
  yearProfit: z.number().nullable().optional(),
  breakEvenRate: z.number().nullable().optional(),
  oneMonthRate: z.number().nullable().optional(),
  threeMonthRate: z.number().nullable().optional(),
  sixMonthRate: z.number().nullable().optional(),
  oneYearRate: z.number().nullable().optional(),
});

export const portfolioSnapshotSchema = z.object({
  id: z.string().min(1),
  source: z.literal("tzzb"),
  sourceAccountId: z.string().min(1),
  accountName: z.string().min(1),
  capturedAt: z.iso.datetime(),
  sourceSyncedAt: z.iso.datetime().nullable(),
  freshness: dataFreshnessSchema,
  currency: z.string().default("CNY"),
  totalAsset: z.number(),
  cash: z.number(),
  stockMarketValue: z.number(),
  dayProfit: z.number().nullable(),
  dayProfitRate: z.number().nullable(),
  positionRate: z.number().nullable(),
  positions: z.array(positionSnapshotSchema),
});

export const industryAllocationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).nullable().optional(),
  value: z.number().nonnegative(),
  weight: z.number().min(0),
  dayRate: z.number().nullable().optional(),
  color: z.string().min(1),
});

export const industryDataStatusSchema = z.object({
  taxonomy: z.string().min(1),
  source: z.string().min(1),
  status: z.enum(["fresh", "stale", "unavailable", "disabled"]),
  syncedAt: z.iso.datetime().nullable(),
  message: z.string().min(1).nullable(),
});

export const portfolioHistoryPointSchema = z.object({
  date: z.string().min(1),
  totalAsset: z.number(),
  positionRate: z.number().nullable(),
});

export type DataFreshness = z.infer<typeof dataFreshnessSchema>;
export type MainIndustry = z.infer<typeof mainIndustrySchema>;
export type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;
export type IndustryAllocation = z.infer<typeof industryAllocationSchema>;
export type IndustryDataStatus = z.infer<typeof industryDataStatusSchema>;
export type PortfolioHistoryPoint = z.infer<typeof portfolioHistoryPointSchema>;
