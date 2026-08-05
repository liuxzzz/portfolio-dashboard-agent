import assert from "node:assert/strict";
import test from "node:test";
import {
  holdingExportFields,
  reconcileHoldingHeaders,
} from "./export-contract.js";

const authoritativeHeaders = [
  "代码", "名称", "持有金额", "当日盈亏", "当日盈亏率", "关联板块", "板块涨幅",
  "组合盈亏", "组合涨幅", "持有盈亏", "持有盈亏率", "累计盈亏", "累计盈亏率",
  "本周盈亏", "本月盈亏", "今年盈亏", "仓位占比", "持有数量", "持仓天数",
  "最新涨幅", "最新价", "单位成本", "回本涨幅", "近1月涨幅", "近3月涨幅",
  "近6月涨幅", "近1年涨幅",
];

test("matches all 27 holding export columns", () => {
  assert.deepEqual(
    holdingExportFields.map((field) => field.header),
    authoritativeHeaders,
  );
  assert.deepEqual(reconcileHoldingHeaders(authoritativeHeaders), {
    complete: true,
    expectedCount: 27,
    actualCount: 27,
    missing: [],
    unexpected: [],
  });
  assert.equal(
    holdingExportFields.filter((field) => field.source === "blank-by-source")
      .length,
    5,
  );
});
