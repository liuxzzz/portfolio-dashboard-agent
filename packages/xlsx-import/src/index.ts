import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import {
  portfolioSnapshotSchema,
  type PortfolioSnapshot,
  type PositionSnapshot,
} from "@portfolio/domain";
import type {
  ExportCell,
  HoldingExport,
  HoldingExportRow,
} from "./export-workbook.js";
import { readHoldingExport } from "./export-workbook.js";

export * from "./export-contract.js";
export * from "./export-workbook.js";

const MONEY_TOLERANCE = 0.11;
const RATE_TOLERANCE = 0.00011;

export interface XlsxImportOptions {
  capturedAt: Date;
  sourceFingerprint?: string;
  accountId?: string;
  accountName?: string;
}

function text(value: ExportCell | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: ExportCell | undefined, label: string) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Excel 字段 ${label} 不是有效数字`);
  }
  return value;
}

function requiredNumber(value: ExportCell | undefined, label: string) {
  const parsed = optionalNumber(value, label);
  if (parsed === null) throw new Error(`Excel 缺少必填数字字段 ${label}`);
  return parsed;
}

function optionalInteger(value: ExportCell | undefined, label: string) {
  const parsed = optionalNumber(value, label);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Excel 字段 ${label} 必须是非负整数`);
  }
  return parsed;
}

function value(row: HoldingExportRow, header: string) {
  return row.values[header];
}

function sumRequired(exported: HoldingExport, header: string) {
  return exported.positions.reduce(
    (sum, row) => sum + requiredNumber(value(row, header), `${row.symbol}.${header}`),
    0,
  );
}

function sumOptional(exported: HoldingExport, header: string) {
  const values = exported.positions.map((row) =>
    optionalNumber(value(row, header), `${row.symbol}.${header}`),
  );
  return values.every((item) => item === null)
    ? null
    : values.reduce<number>((sum, item) => sum + (item ?? 0), 0);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function inferMarket(symbol: string) {
  if (/^\d{5}$/.test(symbol)) return "HK";
  if (/^[569]\d{5}$/.test(symbol)) return "SH";
  if (/^[0123]\d{5}$/.test(symbol)) return "SZ";
  if (/^[478]\d{5}$/.test(symbol)) return "BJ";
  return "UNKNOWN";
}

function positionFromExport(row: HoldingExportRow): PositionSnapshot {
  const name = text(value(row, "名称"));
  if (!name) throw new Error(`Excel 持仓 ${row.symbol} 缺少名称`);
  const relatedSector = text(value(row, "关联板块")) || null;

  return {
    symbol: row.symbol,
    name,
    market: inferMarket(row.symbol),
    industry: null,
    quantity: requiredNumber(value(row, "持有数量"), `${row.symbol}.持有数量`),
    currentPrice: optionalNumber(value(row, "最新价"), `${row.symbol}.最新价`),
    unitCost: optionalNumber(value(row, "单位成本"), `${row.symbol}.单位成本`),
    marketValue: requiredNumber(value(row, "持有金额"), `${row.symbol}.持有金额`),
    portfolioWeight: optionalNumber(
      value(row, "仓位占比"),
      `${row.symbol}.仓位占比`,
    ),
    dayProfit: optionalNumber(value(row, "当日盈亏"), `${row.symbol}.当日盈亏`),
    dayProfitRate: optionalNumber(
      value(row, "当日盈亏率"),
      `${row.symbol}.当日盈亏率`,
    ),
    holdingProfit: optionalNumber(
      value(row, "持有盈亏"),
      `${row.symbol}.持有盈亏`,
    ),
    holdingProfitRate: optionalNumber(
      value(row, "持有盈亏率"),
      `${row.symbol}.持有盈亏率`,
    ),
    holdingDays: optionalInteger(
      value(row, "持仓天数"),
      `${row.symbol}.持仓天数`,
    ),
    latestRate: optionalNumber(value(row, "最新涨幅"), `${row.symbol}.最新涨幅`),
    relatedSector,
    sectorRate: optionalNumber(value(row, "板块涨幅"), `${row.symbol}.板块涨幅`),
    combinationProfit: optionalNumber(
      value(row, "组合盈亏"),
      `${row.symbol}.组合盈亏`,
    ),
    combinationRate: optionalNumber(
      value(row, "组合涨幅"),
      `${row.symbol}.组合涨幅`,
    ),
    cumulativeProfit: optionalNumber(
      value(row, "累计盈亏"),
      `${row.symbol}.累计盈亏`,
    ),
    cumulativeProfitRate: optionalNumber(
      value(row, "累计盈亏率"),
      `${row.symbol}.累计盈亏率`,
    ),
    weekProfit: optionalNumber(value(row, "本周盈亏"), `${row.symbol}.本周盈亏`),
    monthProfit: optionalNumber(value(row, "本月盈亏"), `${row.symbol}.本月盈亏`),
    yearProfit: optionalNumber(value(row, "今年盈亏"), `${row.symbol}.今年盈亏`),
    breakEvenRate: optionalNumber(value(row, "回本涨幅"), `${row.symbol}.回本涨幅`),
    oneMonthRate: optionalNumber(value(row, "近1月涨幅"), `${row.symbol}.近1月涨幅`),
    threeMonthRate: optionalNumber(value(row, "近3月涨幅"), `${row.symbol}.近3月涨幅`),
    sixMonthRate: optionalNumber(value(row, "近6月涨幅"), `${row.symbol}.近6月涨幅`),
    oneYearRate: optionalNumber(value(row, "近1年涨幅"), `${row.symbol}.近1年涨幅`),
  };
}

function assertReconciled(
  label: string,
  calculated: number | null,
  summarized: number | null,
  tolerance: number,
) {
  if (
    calculated !== null &&
    summarized !== null &&
    Math.abs(calculated - summarized) > tolerance
  ) {
    throw new Error(`Excel 汇总字段 ${label} 与持仓逐行合计不一致`);
  }
}

export function createSnapshotFromHoldingExport(
  exported: HoldingExport,
  options: XlsxImportOptions,
): PortfolioSnapshot {
  if (exported.positions.length === 0) {
    throw new Error("Excel 没有可导入的当前持仓");
  }
  if (Number.isNaN(options.capturedAt.getTime())) {
    throw new Error("Excel 导入时间无效");
  }

  const summary =
    exported.summaryRows.find((row) => /汇总|合计/.test(row.label)) ??
    exported.summaryRows.at(-1);
  const summarized = (header: string) =>
    optionalNumber(summary?.values[header], `汇总.${header}`);
  const calculatedMarketValue = sumRequired(exported, "持有金额");
  const calculatedPositionRate = sumOptional(exported, "仓位占比");
  const calculatedDayProfit = sumOptional(exported, "当日盈亏");
  const summarizedMarketValue = summarized("持有金额");
  const summarizedPositionRate = summarized("仓位占比");
  const summarizedDayProfit = summarized("当日盈亏");

  assertReconciled(
    "持有金额",
    calculatedMarketValue,
    summarizedMarketValue,
    MONEY_TOLERANCE,
  );
  assertReconciled(
    "仓位占比",
    calculatedPositionRate,
    summarizedPositionRate,
    RATE_TOLERANCE * Math.max(1, exported.positions.length),
  );
  assertReconciled(
    "当日盈亏",
    calculatedDayProfit,
    summarizedDayProfit,
    MONEY_TOLERANCE,
  );

  const stockMarketValue = roundCurrency(
    summarizedMarketValue ?? calculatedMarketValue,
  );
  const positionRate = summarizedPositionRate ?? calculatedPositionRate;
  if (positionRate === null || positionRate <= 0) {
    throw new Error("Excel 缺少有效仓位占比，无法推导总资产和可用现金");
  }
  const totalAsset = roundCurrency(stockMarketValue / positionRate);
  const cash = roundCurrency(totalAsset - stockMarketValue);
  const dayProfit = summarizedDayProfit ?? calculatedDayProfit;
  const dayProfitRate = summarized("当日盈亏率");
  const capturedAt = options.capturedAt.toISOString();
  const accountId = options.accountId ?? "local-xlsx";
  const positions = exported.positions.map(positionFromExport);
  const identity = JSON.stringify({
    sourceFingerprint: options.sourceFingerprint ?? null,
    accountId,
    capturedAt,
    stockMarketValue,
    positionRate,
    positions,
  });
  const id = `snapshot-xlsx-${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;

  return portfolioSnapshotSchema.parse({
    id,
    source: "tzzb",
    sourceAccountId: accountId,
    accountName: options.accountName ?? "本地 Excel 组合",
    capturedAt,
    sourceSyncedAt: null,
    freshness: "unknown",
    currency: "CNY",
    totalAsset,
    cash,
    stockMarketValue,
    dayProfit: dayProfit === null ? null : roundCurrency(dayProfit),
    dayProfitRate,
    positionRate,
    positions,
  });
}

export async function readPortfolioSnapshotFromXlsx(
  filePath: string,
  options: Omit<XlsxImportOptions, "capturedAt" | "sourceFingerprint"> & {
    capturedAt?: Date;
  } = {},
) {
  const [exported, fileInfo, contents] = await Promise.all([
    readHoldingExport(filePath),
    stat(filePath),
    readFile(filePath),
  ]);
  return createSnapshotFromHoldingExport(exported, {
    ...options,
    capturedAt: options.capturedAt ?? fileInfo.mtime,
    sourceFingerprint: createHash("sha256").update(contents).digest("hex"),
  });
}

export async function readPortfolioSnapshotFromXlsxBuffer(
  contents: Uint8Array,
  options: Omit<XlsxImportOptions, "sourceFingerprint">,
) {
  const buffer = Buffer.from(contents);
  const exported = await readHoldingExport(buffer);
  return createSnapshotFromHoldingExport(exported, {
    ...options,
    sourceFingerprint: createHash("sha256").update(buffer).digest("hex"),
  });
}
