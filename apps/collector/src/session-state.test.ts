import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readLocalSessionState,
  writeLocalSessionState,
} from "./session-state.js";

test("stores the local user marker privately and reads it back", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-session-"));
  try {
    assert.equal(await readLocalSessionState(directory), null);
    await writeLocalSessionState(directory, { userId: "test-user" });

    assert.deepEqual(await readLocalSessionState(directory), {
      userId: "test-user",
    });
    const filePath = path.join(directory, "portfolio-collector-state.json");
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(filePath, "utf8")).userId, "test-user");
  } finally {
    await rm(directory, { recursive: true });
  }
});
