import { accountListResponseSchema } from "./schemas.js";

export type TzzbAccountKind = "manual" | "stockCommon" | "stockRzrq";

export interface TzzbAccount {
  kind: TzzbAccountKind;
  sourceAccountId: string;
  accountName: string;
  manualId: string;
  fundKey: string;
  marginFundKey: string;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function objects(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function accountName(record: Record<string, unknown>, fallback: string) {
  return (
    text(record.manualname) ||
    text(record.manual_name) ||
    text(record.qsmc) ||
    text(record.broker_name) ||
    fallback
  );
}

export function parseStockAccounts(payload: unknown): TzzbAccount[] {
  const data = accountListResponseSchema.parse(payload);
  const accounts: TzzbAccount[] = [];

  for (const record of objects(data.manual)) {
    const manualId = text(record.manualid) || text(record.manual_id);
    if (!manualId) continue;
    accounts.push({
      kind: "manual",
      sourceAccountId: manualId,
      accountName: accountName(record, "手工股票账户"),
      manualId,
      fundKey: "",
      marginFundKey: "",
    });
  }

  for (const record of objects(data.common)) {
    const fundKey = text(record.fund_key);
    if (!fundKey) continue;
    accounts.push({
      kind: "stockCommon",
      sourceAccountId: fundKey,
      accountName: accountName(record, "股票账户"),
      manualId: "",
      fundKey,
      marginFundKey: "",
    });
  }

  for (const record of objects(data.rzrq)) {
    const marginFundKey = text(record.fund_key) || text(record.rzrq_fund_key);
    if (!marginFundKey) continue;
    accounts.push({
      kind: "stockRzrq",
      sourceAccountId: marginFundKey,
      accountName: accountName(record, "融资融券账户"),
      manualId: "",
      fundKey: "",
      marginFundKey,
    });
  }

  return accounts;
}

export function accountRequestParams(account: TzzbAccount) {
  return {
    manual_id: account.manualId,
    fund_key: account.fundKey,
    rzrq_fund_key: account.marginFundKey,
  };
}
