import { readSheet } from "read-excel-file/node";
import {
  holdingExportFields,
  reconcileHoldingHeaders,
} from "./export-contract.js";

export type ExportCell = string | number | boolean | Date | null;

export interface HoldingExportRow {
  symbol: string;
  values: Record<string, ExportCell>;
}

export interface HoldingExport {
  headers: string[];
  positions: HoldingExportRow[];
  ignoredSummaryRows: number;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function exportCell(value: unknown): ExportCell {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  if (value === undefined) return null;
  throw new Error("导出文件包含无法识别的单元格类型");
}

export function parseExportNumber(value: string) {
  return value === "" ? null : Number(value);
}

export function parseHoldingExportRows(
  rows: readonly (readonly unknown[])[],
): HoldingExport {
  const headerRow = rows[0];
  if (!headerRow) throw new Error("导出文件的持仓数据工作表为空");

  const headers = headerRow.map((value) => text(value));
  const headerCheck = reconcileHoldingHeaders(headers);
  if (!headerCheck.complete) {
    throw new Error(
      `导出持仓字段结构发生变化：预期 ${headerCheck.expectedCount} 列，实际 ${headerCheck.actualCount} 列`,
    );
  }

  const positions: HoldingExportRow[] = [];
  let ignoredSummaryRows = 0;
  const symbols = new Set<string>();

  for (const row of rows.slice(1)) {
    if (!row.some(isPresent)) continue;
    const name = text(row[1]);
    if (!name) {
      ignoredSummaryRows += 1;
      continue;
    }
    if (typeof row[0] !== "string") {
      throw new Error("导出文件的股票代码必须保持为文本，避免丢失前导零");
    }
    const symbol = row[0].trim();
    if (!symbol) throw new Error("导出文件存在名称非空但代码为空的持仓行");
    if (symbols.has(symbol)) throw new Error("导出文件存在重复股票代码");
    symbols.add(symbol);

    positions.push({
      symbol,
      values: Object.fromEntries(
        holdingExportFields.map((field, index) => [
          field.header,
          exportCell(row[index]),
        ]),
      ),
    });
  }

  return { headers, positions, ignoredSummaryRows };
}

export async function readHoldingExport(filePath: string) {
  const rows = await readSheet(filePath, "持仓数据", {
    parseNumber: parseExportNumber,
  });
  return parseHoldingExportRows(rows);
}
