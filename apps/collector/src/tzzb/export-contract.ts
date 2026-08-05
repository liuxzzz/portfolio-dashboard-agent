import type { PortfolioSnapshot, PositionSnapshot } from "@portfolio/domain";

export type ExportFieldSource = "direct" | "calculated" | "blank-by-source";
export type FieldCoverageStatus =
  | "complete"
  | "partial"
  | "empty"
  | "blank-by-source"
  | "no-positions";

export interface ExportFieldDefinition {
  header: string;
  source: ExportFieldSource;
  snapshotKey: keyof PositionSnapshot;
  comparison:
    | { kind: "text" }
    | { kind: "number"; absoluteTolerance: number }
    | { kind: "blank" };
}

export const holdingExportFields = [
  { header: "代码", source: "direct", snapshotKey: "symbol", comparison: { kind: "text" } },
  { header: "名称", source: "direct", snapshotKey: "name", comparison: { kind: "text" } },
  { header: "持有金额", source: "calculated", snapshotKey: "marketValue", comparison: { kind: "number", absoluteTolerance: 0.11 } },
  { header: "当日盈亏", source: "calculated", snapshotKey: "dayProfit", comparison: { kind: "number", absoluteTolerance: 0.11 } },
  { header: "当日盈亏率", source: "calculated", snapshotKey: "dayProfitRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "关联板块", source: "blank-by-source", snapshotKey: "relatedSector", comparison: { kind: "blank" } },
  { header: "板块涨幅", source: "blank-by-source", snapshotKey: "sectorRate", comparison: { kind: "blank" } },
  { header: "组合盈亏", source: "blank-by-source", snapshotKey: "combinationProfit", comparison: { kind: "blank" } },
  { header: "组合涨幅", source: "blank-by-source", snapshotKey: "combinationRate", comparison: { kind: "blank" } },
  { header: "持有盈亏", source: "calculated", snapshotKey: "holdingProfit", comparison: { kind: "number", absoluteTolerance: 0.011 } },
  { header: "持有盈亏率", source: "calculated", snapshotKey: "holdingProfitRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "累计盈亏", source: "calculated", snapshotKey: "cumulativeProfit", comparison: { kind: "number", absoluteTolerance: 0.011 } },
  { header: "累计盈亏率", source: "blank-by-source", snapshotKey: "cumulativeProfitRate", comparison: { kind: "blank" } },
  { header: "本周盈亏", source: "calculated", snapshotKey: "weekProfit", comparison: { kind: "number", absoluteTolerance: 0.11 } },
  { header: "本月盈亏", source: "calculated", snapshotKey: "monthProfit", comparison: { kind: "number", absoluteTolerance: 0.11 } },
  { header: "今年盈亏", source: "calculated", snapshotKey: "yearProfit", comparison: { kind: "number", absoluteTolerance: 0.011 } },
  { header: "仓位占比", source: "calculated", snapshotKey: "portfolioWeight", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "持有数量", source: "direct", snapshotKey: "quantity", comparison: { kind: "number", absoluteTolerance: 0 } },
  { header: "持仓天数", source: "direct", snapshotKey: "holdingDays", comparison: { kind: "number", absoluteTolerance: 0 } },
  { header: "最新涨幅", source: "calculated", snapshotKey: "latestRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "最新价", source: "direct", snapshotKey: "currentPrice", comparison: { kind: "number", absoluteTolerance: 0.0011 } },
  { header: "单位成本", source: "direct", snapshotKey: "unitCost", comparison: { kind: "number", absoluteTolerance: 0.0011 } },
  { header: "回本涨幅", source: "calculated", snapshotKey: "breakEvenRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "近1月涨幅", source: "calculated", snapshotKey: "oneMonthRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "近3月涨幅", source: "calculated", snapshotKey: "threeMonthRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "近6月涨幅", source: "calculated", snapshotKey: "sixMonthRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
  { header: "近1年涨幅", source: "calculated", snapshotKey: "oneYearRate", comparison: { kind: "number", absoluteTolerance: 0.00011 } },
] as const satisfies readonly ExportFieldDefinition[];

export function reconcileHoldingHeaders(headers: readonly string[]) {
  const expected = holdingExportFields.map((field) => field.header);
  const missing = expected.filter((header) => !headers.includes(header));
  const unexpected = headers.filter((header) => !expected.includes(header as never));
  const duplicates = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  const orderMatches =
    headers.length === expected.length &&
    expected.every((header, index) => headers[index] === header);

  return {
    complete:
      missing.length === 0 &&
      unexpected.length === 0 &&
      duplicates.length === 0 &&
      orderMatches,
    expectedCount: expected.length,
    actualCount: headers.length,
    missing,
    unexpected,
    duplicates,
    orderMatches,
  };
}

export function assessHoldingFieldCoverage(snapshot: PortfolioSnapshot) {
  return holdingExportFields.map((field) => {
    if (field.source === "blank-by-source") {
      return {
        header: field.header,
        source: field.source,
        status: "blank-by-source" as const,
        populated: 0,
        total: snapshot.positions.length,
      };
    }

    const populated = snapshot.positions.filter((position) => {
      const value = position[field.snapshotKey];
      return value !== null && value !== undefined && value !== "";
    }).length;
    const status: FieldCoverageStatus =
      snapshot.positions.length === 0
        ? "no-positions"
        : populated === snapshot.positions.length
          ? "complete"
          : populated === 0
            ? "empty"
            : "partial";

    return {
      header: field.header,
      source: field.source,
      status,
      populated,
      total: snapshot.positions.length,
    };
  });
}
