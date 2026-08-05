import type { PortfolioSnapshot, PositionSnapshot } from "@portfolio/domain";
import {
  holdingExportFields,
  type ExportFieldDefinition,
  type ExportFieldSource,
} from "./export-contract.js";
import type { ExportCell, HoldingExport } from "./export-workbook.js";

export type FieldReconciliationStatus =
  | "matched"
  | "partial"
  | "mismatch"
  | "blank-by-source"
  | "source-changed"
  | "not-comparable";

export interface FieldReconciliation {
  header: string;
  source: ExportFieldSource;
  comparison: "text" | "number" | "blank";
  absoluteTolerance: number | null;
  status: FieldReconciliationStatus;
  matched: number;
  mismatched: number;
  apiOnly: number;
  exportOnly: number;
  comparedPositions: number;
}

export interface HoldingReconciliationReport {
  complete: boolean;
  apiPositionCount: number;
  exportPositionCount: number;
  matchedPositionCount: number;
  apiOnlyPositionCount: number;
  exportOnlyPositionCount: number;
  ignoredSummaryRows: number;
  fields: FieldReconciliation[];
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function valuesMatch(
  field: ExportFieldDefinition,
  apiValue: unknown,
  exportValue: ExportCell | undefined,
) {
  if (field.comparison.kind === "text") {
    return (
      typeof apiValue === "string" &&
      typeof exportValue === "string" &&
      apiValue.trim() === exportValue.trim()
    );
  }
  if (field.comparison.kind === "number") {
    return (
      typeof apiValue === "number" &&
      Number.isFinite(apiValue) &&
      typeof exportValue === "number" &&
      Number.isFinite(exportValue) &&
      Math.abs(apiValue - exportValue) <=
        field.comparison.absoluteTolerance
    );
  }
  return !isPresent(apiValue) && !isPresent(exportValue);
}

function reconcileField(
  field: ExportFieldDefinition,
  pairs: Array<{
    api: PositionSnapshot;
    exported: HoldingExport["positions"][number];
  }>,
): FieldReconciliation {
  let matched = 0;
  let mismatched = 0;
  let apiOnly = 0;
  let exportOnly = 0;

  for (const pair of pairs) {
    const apiValue = pair.api[field.snapshotKey];
    const exportValue = pair.exported.values[field.header];
    const apiPresent = isPresent(apiValue);
    const exportPresent = isPresent(exportValue);

    if (!apiPresent && !exportPresent) {
      matched += 1;
    } else if (apiPresent && !exportPresent) {
      apiOnly += 1;
    } else if (!apiPresent && exportPresent) {
      exportOnly += 1;
    } else if (valuesMatch(field, apiValue, exportValue)) {
      matched += 1;
    } else {
      mismatched += 1;
    }
  }

  const hasDifferences = mismatched + apiOnly + exportOnly > 0;
  const status: FieldReconciliationStatus =
    pairs.length === 0
      ? "not-comparable"
      : field.comparison.kind === "blank"
        ? hasDifferences
          ? "source-changed"
          : "blank-by-source"
        : !hasDifferences
          ? "matched"
          : matched > 0
            ? "partial"
            : "mismatch";

  return {
    header: field.header,
    source: field.source,
    comparison: field.comparison.kind,
    absoluteTolerance:
      field.comparison.kind === "number"
        ? field.comparison.absoluteTolerance
        : null,
    status,
    matched,
    mismatched,
    apiOnly,
    exportOnly,
    comparedPositions: pairs.length,
  };
}

export function reconcileHoldingExport(
  snapshot: PortfolioSnapshot,
  exported: HoldingExport,
): HoldingReconciliationReport {
  const exportedBySymbol = new Map(
    exported.positions.map((position) => [position.symbol, position]),
  );
  const apiSymbols = new Set(
    snapshot.positions.map((position) => position.symbol),
  );
  const pairs = snapshot.positions.flatMap((api) => {
    const exportedPosition = exportedBySymbol.get(api.symbol);
    return exportedPosition ? [{ api, exported: exportedPosition }] : [];
  });
  const fields = holdingExportFields.map((field) =>
    reconcileField(field, pairs),
  );
  const apiOnlyPositionCount = snapshot.positions.length - pairs.length;
  const exportOnlyPositionCount = exported.positions.filter(
    (position) => !apiSymbols.has(position.symbol),
  ).length;
  const fieldsComplete = fields.every(
    (field) =>
      field.status === "matched" || field.status === "blank-by-source",
  );

  return {
    complete:
      apiOnlyPositionCount === 0 &&
      exportOnlyPositionCount === 0 &&
      fieldsComplete,
    apiPositionCount: snapshot.positions.length,
    exportPositionCount: exported.positions.length,
    matchedPositionCount: pairs.length,
    apiOnlyPositionCount,
    exportOnlyPositionCount,
    ignoredSummaryRows: exported.ignoredSummaryRows,
    fields,
  };
}
