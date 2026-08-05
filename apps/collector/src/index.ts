import { createHash } from "node:crypto";
import { loadCollectorConfig, loadLocalEnv } from "./config.js";
import { publishSnapshot } from "./publisher.js";
import { TzzbClient } from "./tzzb/client.js";
import { assessHoldingFieldCoverage } from "./tzzb/export-contract.js";
import {
  reconcileHoldingExport,
  type HoldingReconciliationReport,
} from "./tzzb/export-reconciliation.js";
import { readHoldingExport } from "./tzzb/export-workbook.js";
import {
  openInteractiveLogin,
  PlaywrightTzzbTransport,
} from "./tzzb/playwright-transport.js";

function redactedAccountId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function reconciliationDifferenceCount(report: HoldingReconciliationReport) {
  return report.fields.reduce(
    (sum, field) =>
      sum + field.mismatched + field.apiOnly + field.exportOnly,
    0,
  );
}

async function main() {
  loadLocalEnv();
  const command = process.argv[2] ?? "collect";
  const config = loadCollectorConfig();
  const transportOptions = {
    baseUrl: config.baseUrl,
    profileDir: config.profileDir,
    browserChannel: config.browserChannel,
    headless: config.headless,
    userId: config.userId,
  };

  if (command === "login") {
    await openInteractiveLogin(transportOptions);
    return;
  }
  if (
    command !== "collect" &&
    command !== "audit" &&
    command !== "reconcile"
  ) {
    throw new Error(
      `未知命令：${command}；支持 login、collect、audit 或 reconcile`,
    );
  }
  const exportPath = process.argv.slice(3).find((value) => value !== "--");
  if (command === "reconcile" && !exportPath) {
    throw new Error("reconcile 命令需要提供同花顺导出的 .xlsx 文件路径");
  }
  const exported =
    command === "reconcile" && exportPath
      ? await readHoldingExport(exportPath)
      : undefined;

  const transport = await PlaywrightTzzbTransport.create(transportOptions);
  const client = new TzzbClient(transport);
  try {
    const snapshots = await client.collect({
      accountIds: config.accountIds,
      rateUnit: config.rateUnit,
    });
    if (command === "reconcile" && exported) {
      const candidates = snapshots
        .map((snapshot) => ({
          snapshot,
          report: reconcileHoldingExport(snapshot, exported),
        }))
        .sort((left, right) => {
          if (
            left.report.matchedPositionCount !==
            right.report.matchedPositionCount
          ) {
            return (
              right.report.matchedPositionCount -
              left.report.matchedPositionCount
            );
          }
          const leftUnmatched =
            left.report.apiOnlyPositionCount +
            left.report.exportOnlyPositionCount;
          const rightUnmatched =
            right.report.apiOnlyPositionCount +
            right.report.exportOnlyPositionCount;
          if (leftUnmatched !== rightUnmatched) {
            return leftUnmatched - rightUnmatched;
          }
          const leftFieldDifferences = reconciliationDifferenceCount(
            left.report,
          );
          const rightFieldDifferences = reconciliationDifferenceCount(
            right.report,
          );
          return leftFieldDifferences - rightFieldDifferences;
        });
      const selected = candidates[0];
      if (!selected) throw new Error("没有可用于导出对账的股票账户");
      if (
        candidates.length > 1 &&
        selected.report.matchedPositionCount === 0
      ) {
        throw new Error(
          "无法自动判断导出文件所属账户，请通过 TZZB_ACCOUNT_IDS 指定账户",
        );
      }
      const runnerUp = candidates[1];
      if (
        runnerUp &&
        selected.report.matchedPositionCount ===
          runnerUp.report.matchedPositionCount &&
        selected.report.apiOnlyPositionCount ===
          runnerUp.report.apiOnlyPositionCount &&
        selected.report.exportOnlyPositionCount ===
          runnerUp.report.exportOnlyPositionCount &&
        reconciliationDifferenceCount(selected.report) ===
          reconciliationDifferenceCount(runnerUp.report)
      ) {
        throw new Error(
          "多个账户与导出文件的匹配程度相同，请通过 TZZB_ACCOUNT_IDS 指定账户",
        );
      }
      console.log(
        JSON.stringify(
          {
            status: selected.report.complete
              ? "reconciled"
              : "differences-found",
            account: redactedAccountId(selected.snapshot.sourceAccountId),
            capturedAt: selected.snapshot.capturedAt,
            sourceSyncedAt: selected.snapshot.sourceSyncedAt,
            ...selected.report,
          },
          null,
          2,
        ),
      );
      if (!selected.report.complete) process.exitCode = 2;
      return;
    }
    for (const snapshot of snapshots) {
      if (command === "audit") {
        console.log(
          JSON.stringify(
            {
              status: "audited",
              account: redactedAccountId(snapshot.sourceAccountId),
              capturedAt: snapshot.capturedAt,
              sourceSyncedAt: snapshot.sourceSyncedAt,
              freshness: snapshot.freshness,
              positionCount: snapshot.positions.length,
              fieldCoverage: assessHoldingFieldCoverage(snapshot),
            },
            null,
            2,
          ),
        );
        continue;
      }
      if (
        config.apiConfigured &&
        config.apiUrl &&
        config.ingestSharedSecret
      ) {
        await publishSnapshot(snapshot, {
          apiUrl: config.apiUrl,
          ingestSharedSecret: config.ingestSharedSecret,
        });
      }
      console.log(
        JSON.stringify({
          status: config.apiConfigured ? "uploaded" : "validated",
          account: redactedAccountId(snapshot.sourceAccountId),
          capturedAt: snapshot.capturedAt,
          sourceSyncedAt: snapshot.sourceSyncedAt,
          freshness: snapshot.freshness,
          positionCount: snapshot.positions.length,
        }),
      );
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "采集器运行失败");
  process.exitCode = 1;
});
