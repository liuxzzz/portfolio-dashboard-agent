import { apiEnvelopeSchema } from "./schemas.js";

export class TzzbAuthenticationError extends Error {
  constructor() {
    super("同花顺登录状态无效，请先运行 pnpm --filter @portfolio/collector run login");
    this.name = "TzzbAuthenticationError";
  }
}

export class TzzbApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "TzzbApiError";
  }
}

export interface TzzbTransport {
  post(path: string, params: Record<string, string>): Promise<unknown>;
  close(): Promise<void>;
}

export function unwrapApiEnvelope(payload: unknown) {
  const envelope = apiEnvelopeSchema.parse(payload);
  const code = String(envelope.error_code);
  if (code !== "0" || envelope.ex_data === undefined) {
    if (/登录|login|cookie|鉴权|认证/i.test(envelope.error_msg ?? "")) {
      throw new TzzbAuthenticationError();
    }
    throw new TzzbApiError(envelope.error_msg ?? "同花顺接口请求异常", code);
  }
  return envelope.ex_data;
}
