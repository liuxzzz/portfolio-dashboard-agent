import assert from "node:assert/strict";
import test from "node:test";
import { accountRequestParams, parseStockAccounts } from "./accounts.js";

test("parses all three stock account families", () => {
  const accounts = parseStockAccounts({
    manual: [{ manualid: "manual-1", manualname: "演示手工账户" }],
    common: [{ fund_key: "common-1", manualname: "演示普通账户" }],
    rzrq: [{ fund_key: "margin-1", manualname: "演示信用账户" }],
    fund: [],
  });

  assert.equal(accounts.length, 3);
  assert.deepEqual(accountRequestParams(accounts[0]!), {
    manual_id: "manual-1",
    fund_key: "",
    rzrq_fund_key: "",
  });
  assert.deepEqual(accountRequestParams(accounts[1]!), {
    manual_id: "",
    fund_key: "common-1",
    rzrq_fund_key: "",
  });
  assert.deepEqual(accountRequestParams(accounts[2]!), {
    manual_id: "",
    fund_key: "",
    rzrq_fund_key: "margin-1",
  });
});
