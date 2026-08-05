import assert from "node:assert/strict";
import test from "node:test";
import { extractCapturedUserId } from "./interactive-session.js";

test("extracts the successful page request user marker", () => {
  assert.equal(
    extractCapturedUserId("terminal=1&userid=local-user&manual_id=demo"),
    "local-user",
  );
  assert.equal(extractCapturedUserId("user_id=fallback-user"), "fallback-user");
  assert.equal(extractCapturedUserId(null), null);
});
