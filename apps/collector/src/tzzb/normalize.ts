import { createHash } from "node:crypto";
import {
  portfolioSnapshotSchema,
  type DataFreshness,
  type PortfolioSnapshot,
  type PositionSnapshot,
} from "@portfolio/domain";
import type { TzzbAccount } from "./accounts.js";
import type {
  RawPosition,
  RawQuote,
  RawTrade,
  RawTransfer,
  StockPositionResponse,
} from "./schemas.js";

export type RateUnit = "percent" | "decimal";

export interface NormalizeSnapshotInput {
  account: TzzbAccount;
  positionResponse: StockPositionResponse;
  trades: RawTrade[];
  transfers: RawTransfer[];
  quotes: RawQuote[];
  capturedAt: Date;
  rateUnit?: RateUnit | undefined;
  staleAfterHours?: number | undefined;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function finiteNumber(value: unknown): number | null {
  const normalized = text(value).replace(/^HK\$/, "").replaceAll(",", "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function requiredNumber(value: unknown, label: string) {
  const number = finiteNumber(value);
  if (number === null) {
    throw new Error(`missing numeric field: ${label}`);
  }
  return number;
}

function rate(value: unknown, unit: RateUnit) {
  const number = finiteNumber(value);
  if (number === null) return null;
  return unit === "percent" ? number / 100 : number;
}

function parseSourceTime(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(raw)
    ? `${raw.replace(" ", "T")}${raw.length === 16 ? ":00" : ""}+08:00`
    : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function freshness(
  sourceSyncedAt: string | null,
  capturedAt: Date,
  staleAfterHours: number,
): DataFreshness {
  if (!sourceSyncedAt) return "unknown";
  const age = capturedAt.getTime() - new Date(sourceSyncedAt).getTime();
  return age > staleAfterHours * 3_600_000 ? "stale" : "fresh";
}

function quoteKey(market: unknown, code: unknown) {
  return `${text(market)}:${text(code)}`;
}

function isHongKongPosition(position: RawPosition) {
  const hkMarket = text(position.hkmarket);
  const code = text(position.code);
  return (hkMarket !== "" && hkMarket !== "0") || /^\d{5}$/.test(code);
}

function classifyTrade(trade: RawTrade): "buy" | "sell" | null {
  const label = text(trade.czlx);
  if (label.includes("买")) return "buy";
  if (label.includes("卖")) return "sell";
  return null;
}

function calculateDayProfit(
  quantity: number,
  currentPrice: number | null,
  previousClose: number | null,
  trades: RawTrade[],
  exchangeRate: number,
) {
  if (currentPrice === null || previousClose === null) return null;

  let buyQuantity = 0;
  let sellQuantity = 0;
  let tradeContribution = 0;
  let fees = 0;

  for (const trade of trades) {
    const kind = classifyTrade(trade);
    const tradeQuantity = finiteNumber(trade.cjsl);
    const tradePrice = finiteNumber(trade.cjjg);
    if (!kind || tradeQuantity === null || tradePrice === null) return null;

    if (kind === "buy") {
      buyQuantity += tradeQuantity;
      tradeContribution += tradeQuantity * (currentPrice - tradePrice);
    } else {
      sellQuantity += tradeQuantity;
      tradeContribution += tradeQuantity * (tradePrice - previousClose);
    }
    fees += finiteNumber(trade.fee) ?? 0;
  }

  const openingQuantity = quantity - buyQuantity + sellQuantity;
  return (
    (openingQuantity * (currentPrice - previousClose) + tradeContribution) *
      exchangeRate -
    fees
  );
}

function compoundRate(base: number | null, delta: number | null) {
  if (base === null || delta === null) return base;
  return (1 + base) * (1 + delta) - 1;
}

function normalizePosition(
  raw: RawPosition,
  accountTotalAsset: number,
  quote: RawQuote | undefined,
  trades: RawTrade[],
  rateUnit: RateUnit,
): PositionSnapshot {
  const symbol = text(raw.code);
  const name = text(raw.name);
  const market = text(raw.market);
  if (!symbol || !name || !market) {
    throw new Error("position is missing code, name, or market");
  }

  const quantity = requiredNumber(raw.count, `${symbol}.count`);
  const basePrice = finiteNumber(raw.price);
  const quotedPrice = finiteNumber(quote?.xianjia);
  const previousClose = finiteNumber(quote?.zuoshou);
  const currentPrice = quotedPrice ?? basePrice;
  const unitCost = finiteNumber(raw.cost);
  const baseMarketValue = requiredNumber(raw.value, `${symbol}.value`);
  const baseHoldingProfit = finiteNumber(raw.hold_profit);
  const exchangeRate = 1;
  const canApplyQuoteDelta = !isHongKongPosition(raw);
  const quoteDelta =
    canApplyQuoteDelta && currentPrice !== null && basePrice !== null
      ? (currentPrice - basePrice) * quantity * exchangeRate
      : 0;
  const marketValue = baseMarketValue + quoteDelta;
  const holdingProfit =
    baseHoldingProfit === null ? null : baseHoldingProfit + quoteDelta;
  const costBasis = unitCost === null ? null : unitCost * quantity * exchangeRate;
  const holdingProfitRate =
    holdingProfit !== null && costBasis !== null && costBasis !== 0
      ? holdingProfit / costBasis
      : rate(raw.hold_rate, rateUnit);
  const dayProfit = calculateDayProfit(
    quantity,
    currentPrice,
    previousClose,
    trades,
    exchangeRate,
  );
  const previousMarketValue =
    dayProfit === null ? null : marketValue - dayProfit;
  const dayProfitRate =
    dayProfit !== null && previousMarketValue !== null && previousMarketValue !== 0
      ? dayProfit / previousMarketValue
      : null;
  const currentQuoteDeltaRate =
    canApplyQuoteDelta && currentPrice !== null && basePrice !== null && basePrice !== 0
      ? currentPrice / basePrice - 1
      : null;
  const closeProfit = finiteNumber(raw.close_profit);

  return {
    symbol,
    name,
    market,
    industry: null,
    quantity,
    currentPrice,
    unitCost,
    marketValue,
    portfolioWeight:
      accountTotalAsset === 0 ? null : marketValue / accountTotalAsset,
    dayProfit,
    dayProfitRate,
    holdingProfit,
    holdingProfitRate,
    holdingDays: finiteNumber(raw.hold_days),
    latestRate:
      currentPrice !== null && previousClose !== null && previousClose !== 0
        ? currentPrice / previousClose - 1
        : null,
    relatedSector: null,
    sectorRate: null,
    combinationProfit: null,
    combinationRate: null,
    cumulativeProfit:
      holdingProfit === null || closeProfit === null
        ? null
        : holdingProfit + closeProfit,
    cumulativeProfitRate: null,
    weekProfit:
      finiteNumber(raw.w_profit) === null
        ? null
        : requiredNumber(raw.w_profit, `${symbol}.w_profit`) + quoteDelta,
    monthProfit:
      finiteNumber(raw.m_profit) === null
        ? null
        : requiredNumber(raw.m_profit, `${symbol}.m_profit`) + quoteDelta,
    yearProfit:
      finiteNumber(raw.y_profit) === null
        ? null
        : requiredNumber(raw.y_profit, `${symbol}.y_profit`) + quoteDelta,
    breakEvenRate:
      unitCost !== null && currentPrice !== null && currentPrice !== 0
        ? (unitCost - currentPrice) / currentPrice
        : null,
    oneMonthRate: compoundRate(
      rate(raw.m1_rate, rateUnit),
      currentQuoteDeltaRate,
    ),
    threeMonthRate: compoundRate(
      rate(raw.m3_rate, rateUnit),
      currentQuoteDeltaRate,
    ),
    sixMonthRate: compoundRate(
      rate(raw.m6_rate, rateUnit),
      currentQuoteDeltaRate,
    ),
    oneYearRate: compoundRate(
      rate(raw.m12_rate, rateUnit),
      currentQuoteDeltaRate,
    ),
  };
}

export function normalizeSnapshot(input: NormalizeSnapshotInput): PortfolioSnapshot {
  const rateUnit = input.rateUnit ?? "percent";
  const staleAfterHours = input.staleAfterHours ?? 36;
  const baseTotalAsset = requiredNumber(
    input.positionResponse.total_value,
    "total_value",
  );
  const baseStockMarketValue = requiredNumber(
    input.positionResponse.total_asset,
    "total_asset",
  );
  const quotes = new Map(
    input.quotes.map((quote) => [quoteKey(quote.scdm, quote.zqdm), quote]),
  );
  const tradesByPosition = new Map<string, RawTrade[]>();
  for (const trade of input.trades) {
    const key = quoteKey(trade.market, trade.zqdm);
    const current = tradesByPosition.get(key) ?? [];
    current.push(trade);
    tradesByPosition.set(key, current);
  }

  const provisional = input.positionResponse.position.map((position) => {
    const key = quoteKey(position.market, position.code);
    return normalizePosition(
      position,
      baseTotalAsset,
      quotes.get(key),
      tradesByPosition.get(key) ?? [],
      rateUnit,
    );
  });
  const basePositionValue = input.positionResponse.position.reduce(
    (sum, position) => sum + requiredNumber(position.value, "position.value"),
    0,
  );
  const normalizedPositionValue = provisional.reduce(
    (sum, position) => sum + position.marketValue,
    0,
  );
  const quoteDelta = normalizedPositionValue - basePositionValue;
  const totalAsset = baseTotalAsset + quoteDelta;
  const stockMarketValue = baseStockMarketValue + quoteDelta;
  const positions = provisional.map((position) => ({
    ...position,
    portfolioWeight:
      totalAsset === 0 ? null : position.marketValue / totalAsset,
  }));
  const allDayProfitsAvailable = positions.every(
    (position) => position.dayProfit !== null,
  );
  const dayProfit = allDayProfitsAvailable
    ? positions.reduce((sum, position) => sum + (position.dayProfit ?? 0), 0)
    : null;
  const transferTotal = input.transfers.reduce(
    (sum, transfer) => sum + (finiteNumber(transfer.entry_money_signed) ?? 0),
    0,
  );
  const openingAsset =
    dayProfit === null ? null : totalAsset - dayProfit - transferTotal;
  const dayProfitRate =
    dayProfit !== null && openingAsset !== null && openingAsset !== 0
      ? dayProfit / openingAsset
      : null;
  const sourceSyncedAt = parseSourceTime(input.positionResponse.upload_time);
  const capturedAt = input.capturedAt.toISOString();
  const id = createHash("sha256")
    .update(`${input.account.sourceAccountId}:${capturedAt}`)
    .digest("hex")
    .slice(0, 24);

  return portfolioSnapshotSchema.parse({
    id: `tzzb:${id}`,
    source: "tzzb",
    sourceAccountId: input.account.sourceAccountId,
    accountName: input.account.accountName,
    capturedAt,
    sourceSyncedAt,
    freshness: freshness(sourceSyncedAt, input.capturedAt, staleAfterHours),
    currency: "CNY",
    totalAsset,
    cash: requiredNumber(input.positionResponse.money_remain, "money_remain"),
    stockMarketValue,
    dayProfit,
    dayProfitRate,
    positionRate: totalAsset === 0 ? null : stockMarketValue / totalAsset,
    positions,
  });
}
