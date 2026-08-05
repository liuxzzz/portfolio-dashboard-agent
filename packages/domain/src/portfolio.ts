import { z } from "zod";

export const dataFreshnessSchema = z.enum(["fresh", "stale", "unknown"]);

export const positionSnapshotSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  market: z.string().min(1),
  industry: z.string().nullable(),
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
  value: z.number().nonnegative(),
  weight: z.number().min(0),
  color: z.string().min(1),
});

export const portfolioHistoryPointSchema = z.object({
  date: z.string().min(1),
  totalAsset: z.number(),
  positionRate: z.number().nullable(),
});

export type DataFreshness = z.infer<typeof dataFreshnessSchema>;
export type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;
export type IndustryAllocation = z.infer<typeof industryAllocationSchema>;
export type PortfolioHistoryPoint = z.infer<typeof portfolioHistoryPointSchema>;

