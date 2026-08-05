import assert from "node:assert/strict";
import test from "node:test";
import type { PortfolioSnapshot } from "@portfolio/domain";
import { publishSnapshot } from "./publisher.js";

test("publishes only the standardized snapshot with bearer authentication", async () => {
  let capturedRequest: Request | undefined;
  const fetcher: typeof fetch = async (input, init) => {
    capturedRequest = new Request(input, init);
    return Response.json(
      {
        accepted: true,
        snapshotId: "snapshot-test",
        capturedAt: "2026-08-05T08:30:00.000Z",
        agentRunId: "run-test",
      },
      { status: 202 },
    );
  };
  const snapshot = {
    id: "snapshot-test",
    source: "tzzb",
    sourceAccountId: "account-test",
    accountName: "虚构账户",
    capturedAt: "2026-08-05T08:30:00.000Z",
    sourceSyncedAt: "2026-08-05T08:00:00.000Z",
    freshness: "fresh",
    currency: "CNY",
    totalAsset: 0,
    cash: 0,
    stockMarketValue: 0,
    dayProfit: 0,
    dayProfitRate: null,
    positionRate: null,
    positions: [],
  } satisfies PortfolioSnapshot;

  const result = await publishSnapshot(snapshot, {
    apiUrl: "https://60.205.90.12/maomao-api",
    ingestSharedSecret: "fictional-secret",
    fetch: fetcher,
  });

  assert.equal(result.accepted, true);
  assert.equal(
    capturedRequest?.url,
    "https://60.205.90.12/maomao-api/v1/snapshots",
  );
  assert.equal(capturedRequest?.headers.get("authorization"), "Bearer fictional-secret");
  assert.equal(capturedRequest?.headers.get("cookie"), null);
  assert.deepEqual(await capturedRequest?.json(), snapshot);
});
