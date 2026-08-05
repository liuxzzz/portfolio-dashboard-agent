import { z } from "zod";

export const positionSnapshotSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  market: z.string().min(1),
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
  source: z.literal("tzzb"),
  sourceAccountId: z.string().min(1),
  capturedAt: z.iso.datetime(),
  sourceSyncedAt: z.iso.datetime().nullable(),
  currency: z.string().default("CNY"),
  totalAsset: z.number(),
  cash: z.number(),
  stockMarketValue: z.number(),
  positionRate: z.number().nullable(),
  positions: z.array(positionSnapshotSchema),
});

export type PositionSnapshot = z.infer<typeof positionSnapshotSchema>;
export type PortfolioSnapshot = z.infer<typeof portfolioSnapshotSchema>;

