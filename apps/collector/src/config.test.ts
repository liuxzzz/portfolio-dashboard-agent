import assert from "node:assert/strict";
import test from "node:test";
import { loadCollectorConfig } from "./config.js";

test("accepts blank optional local connection settings", () => {
  const config = loadCollectorConfig({
    TZZB_CDP_URL: "",
    TZZB_CHROME_EXECUTABLE: "",
    PORTFOLIO_API_URL: "",
  });

  assert.equal(config.cdpUrl, undefined);
  assert.equal(config.chromeExecutable, undefined);
  assert.equal(config.apiUrl, undefined);
});
