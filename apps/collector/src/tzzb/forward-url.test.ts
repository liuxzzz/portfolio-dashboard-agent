import assert from "node:assert/strict";
import test from "node:test";
import { buildTzzbForwardUrl } from "./forward-url.js";

test("builds the forwarding URL used by the current TZZB web client", () => {
  assert.equal(
    buildTzzbForwardUrl(
      "https://tzzb.10jqka.com.cn",
      "/caishen_fund/pc/account/v1/account_list",
    ),
    "https://tzzb.10jqka.com.cn/caishen_httpserver/tzzb/caishen_fund/pc/account/v1/account_list",
  );
});

test("normalizes endpoint paths without a leading slash", () => {
  assert.equal(
    buildTzzbForwardUrl(
      "https://tzzb.10jqka.com.cn",
      "caishen_fund/invest/v1/pass_quotes",
    ),
    "https://tzzb.10jqka.com.cn/caishen_httpserver/tzzb/caishen_fund/invest/v1/pass_quotes",
  );
});
