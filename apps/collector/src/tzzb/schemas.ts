import { z } from "zod";

const scalarSchema = z.union([z.string(), z.number(), z.null()]).optional();

export const apiEnvelopeSchema = z
  .object({
    error_code: z.union([z.string(), z.number()]),
    error_msg: z.string().optional(),
    ex_data: z.unknown().optional(),
  })
  .passthrough();

export const accountListResponseSchema = z.record(z.string(), z.unknown());

export const rawPositionSchema = z
  .object({
    code: scalarSchema,
    name: scalarSchema,
    market: scalarSchema,
    hkmarket: scalarSchema,
    price: scalarSchema,
    count: scalarSchema,
    hold_days: scalarSchema,
    cost: scalarSchema,
    value: scalarSchema,
    pre_profit: scalarSchema,
    pre_rate: scalarSchema,
    before_pre_profit: scalarSchema,
    before_pre_rate: scalarSchema,
    hold_profit: scalarSchema,
    hold_rate: scalarSchema,
    fee: scalarSchema,
    close_profit: scalarSchema,
    close_rate: scalarSchema,
    back: scalarSchema,
    w_profit: scalarSchema,
    m_profit: scalarSchema,
    y_profit: scalarSchema,
    m1_rate: scalarSchema,
    m3_rate: scalarSchema,
    m6_rate: scalarSchema,
    m12_rate: scalarSchema,
    remark: scalarSchema,
    stock_account: scalarSchema,
  })
  .passthrough();

export const stockPositionResponseSchema = z
  .object({
    upload_time: scalarSchema,
    total_liability: scalarSchema,
    money_remain: scalarSchema,
    total_value: scalarSchema,
    total_asset: scalarSchema,
    position_rate: scalarSchema,
    position: z.array(rawPositionSchema),
  })
  .passthrough();

export const rawTradeSchema = z
  .object({
    zqdm: scalarSchema,
    zqmc: scalarSchema,
    cjjg: scalarSchema,
    czlx: scalarSchema,
    cjsl: scalarSchema,
    czdm: scalarSchema,
    fee: scalarSchema,
    moneychg: scalarSchema,
    remainchg: scalarSchema,
    stock_account: scalarSchema,
    market: scalarSchema,
  })
  .passthrough();

export const mergeTradesResponseSchema = z
  .object({ data: z.array(rawTradeSchema).default([]) })
  .passthrough();

export const rawTransferSchema = z
  .object({
    entry_date: scalarSchema,
    entry_money: scalarSchema,
    entry_money_signed: scalarSchema,
    money_remain: scalarSchema,
    op: scalarSchema,
  })
  .passthrough();

export const bankHistoryResponseSchema = z
  .object({ stock: z.array(rawTransferSchema).default([]) })
  .passthrough();

export const rawQuoteSchema = z
  .object({
    xianjia: scalarSchema,
    zuoshou: scalarSchema,
    scdm: scalarSchema,
    zqdm: scalarSchema,
  })
  .passthrough();

export const quotesResponseSchema = z.array(rawQuoteSchema);

export type RawPosition = z.infer<typeof rawPositionSchema>;
export type StockPositionResponse = z.infer<typeof stockPositionResponseSchema>;
export type RawTrade = z.infer<typeof rawTradeSchema>;
export type RawTransfer = z.infer<typeof rawTransferSchema>;
export type RawQuote = z.infer<typeof rawQuoteSchema>;
