import { createHash } from "node:crypto";
import { loadCollectorConfig, loadLocalEnv } from "./config.js";
import { publishSnapshot } from "./publisher.js";
import { TzzbClient } from "./tzzb/client.js";
import {
  openInteractiveLogin,
  PlaywrightTzzbTransport,
} from "./tzzb/playwright-transport.js";

function redactedAccountId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
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
  if (command !== "collect") {
    throw new Error(`未知命令：${command}；支持 login 或 collect`);
  }

  const transport = await PlaywrightTzzbTransport.create(transportOptions);
  const client = new TzzbClient(transport);
  try {
    const snapshots = await client.collect({
      accountIds: config.accountIds,
      rateUnit: config.rateUnit,
    });
    for (const snapshot of snapshots) {
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
