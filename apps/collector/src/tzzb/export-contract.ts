export type ExportFieldSource = "direct" | "calculated" | "blank-by-source";

export interface ExportFieldDefinition {
  header: string;
  source: ExportFieldSource;
  snapshotKey: string;
}

export const holdingExportFields = [
  { header: "代码", source: "direct", snapshotKey: "symbol" },
  { header: "名称", source: "direct", snapshotKey: "name" },
  { header: "持有金额", source: "calculated", snapshotKey: "marketValue" },
  { header: "当日盈亏", source: "calculated", snapshotKey: "dayProfit" },
  { header: "当日盈亏率", source: "calculated", snapshotKey: "dayProfitRate" },
  { header: "关联板块", source: "blank-by-source", snapshotKey: "relatedSector" },
  { header: "板块涨幅", source: "blank-by-source", snapshotKey: "sectorRate" },
  { header: "组合盈亏", source: "blank-by-source", snapshotKey: "combinationProfit" },
  { header: "组合涨幅", source: "blank-by-source", snapshotKey: "combinationRate" },
  { header: "持有盈亏", source: "calculated", snapshotKey: "holdingProfit" },
  { header: "持有盈亏率", source: "calculated", snapshotKey: "holdingProfitRate" },
  { header: "累计盈亏", source: "calculated", snapshotKey: "cumulativeProfit" },
  { header: "累计盈亏率", source: "blank-by-source", snapshotKey: "cumulativeProfitRate" },
  { header: "本周盈亏", source: "calculated", snapshotKey: "weekProfit" },
  { header: "本月盈亏", source: "calculated", snapshotKey: "monthProfit" },
  { header: "今年盈亏", source: "calculated", snapshotKey: "yearProfit" },
  { header: "仓位占比", source: "calculated", snapshotKey: "portfolioWeight" },
  { header: "持有数量", source: "direct", snapshotKey: "quantity" },
  { header: "持仓天数", source: "direct", snapshotKey: "holdingDays" },
  { header: "最新涨幅", source: "calculated", snapshotKey: "latestRate" },
  { header: "最新价", source: "direct", snapshotKey: "currentPrice" },
  { header: "单位成本", source: "direct", snapshotKey: "unitCost" },
  { header: "回本涨幅", source: "calculated", snapshotKey: "breakEvenRate" },
  { header: "近1月涨幅", source: "calculated", snapshotKey: "oneMonthRate" },
  { header: "近3月涨幅", source: "calculated", snapshotKey: "threeMonthRate" },
  { header: "近6月涨幅", source: "calculated", snapshotKey: "sixMonthRate" },
  { header: "近1年涨幅", source: "calculated", snapshotKey: "oneYearRate" },
] as const satisfies readonly ExportFieldDefinition[];

export function reconcileHoldingHeaders(headers: readonly string[]) {
  const expected = holdingExportFields.map((field) => field.header);
  const missing = expected.filter((header) => !headers.includes(header));
  const unexpected = headers.filter((header) => !expected.includes(header as never));

  return {
    complete: missing.length === 0 && unexpected.length === 0,
    expectedCount: expected.length,
    actualCount: headers.length,
    missing,
    unexpected,
  };
}
