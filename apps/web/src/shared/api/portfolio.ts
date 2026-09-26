import {
  agentRunSchema,
  dashboardPayloadSchema,
  industryTagSchema,
  type AgentRun,
  type DashboardPayload,
  type IndustryTag,
} from "@portfolio/domain";
import { z } from "zod";

const SESSION_KEY = "portfolio-agent-web-session-v1";

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
  user: z.object({ id: z.string().min(1), phone: z.string().min(1) }),
});

const userResponseSchema = z.object({ user: sessionSchema.shape.user });
const smsResponseSchema = z.object({
  sent: z.literal(true),
  retryAfterSeconds: z.number().int().nonnegative(),
});
const importResponseSchema = z.object({
  imported: z.literal(true),
  duplicate: z.boolean(),
  snapshotId: z.string(),
  capturedAt: z.iso.datetime(),
  positionCount: z.number().int().nonnegative(),
  agentRunId: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;
export type AuthUser = Session["user"];
export type ImportResult = z.infer<typeof importResponseSchema>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(errorMessage(status, code));
    this.name = "ApiError";
  }
}

export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = sessionSchema.parse(JSON.parse(raw));
    if (Date.parse(session.expiresAt) <= Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // The active tab can still use this session when storage is unavailable.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be disabled by the browser.
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: string; body?: BodyInit; token?: string; json?: boolean } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(options.json ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: options.body }),
    });
  } catch {
    throw new Error("无法连接 Portfolio API，请确认后端已启动。");
  }

  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "request_failed";
    throw new ApiError(response.status, code);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("API 返回的数据不符合当前契约，请检查 Web 与后端版本。");
  }
  return parsed.data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export function requestSmsCode(phone: string) {
  return request("/v1/auth/sms-codes", smsResponseSchema, {
    method: "POST",
    body: JSON.stringify({ phone }),
    json: true,
  });
}

export function createSession(phone: string, code: string) {
  return request("/v1/auth/sessions", sessionSchema, {
    method: "POST",
    body: JSON.stringify({ phone, code }),
    json: true,
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return (await request("/v1/auth/me", userResponseSchema, { token })).user;
}

export async function revokeSession(token: string): Promise<void> {
  await request("/v1/auth/session", z.object({ loggedOut: z.literal(true) }), {
    token,
    method: "DELETE",
  });
}

export function getDashboard(token: string): Promise<DashboardPayload> {
  return request("/v1/dashboard", dashboardPayloadSchema, { token });
}

export function getIndustryTags(token: string): Promise<IndustryTag[]> {
  return request("/v1/industry-tags", z.array(industryTagSchema), { token });
}

export function createIndustryTag(token: string, name: string, color: string): Promise<IndustryTag> {
  return request("/v1/industry-tags", industryTagSchema, {
    token, method: "POST", body: JSON.stringify({ name, color }), json: true,
  });
}

export function deleteIndustryTag(token: string, tagId: string): Promise<void> {
  return request(`/v1/industry-tags/${encodeURIComponent(tagId)}`, z.object({ deleted: z.literal(true) }), {
    token, method: "DELETE",
  }).then(() => undefined);
}

export function setPositionIndustryTag(token: string, market: string, symbol: string, tagId: string): Promise<void> {
  return request(`/v1/positions/${encodeURIComponent(market)}/${encodeURIComponent(symbol)}/industry-tag`, z.unknown(), {
    token, method: "PUT", body: JSON.stringify({ tagId }), json: true,
  }).then(() => undefined);
}

export function restorePositionIndustry(token: string, market: string, symbol: string): Promise<void> {
  return request(`/v1/positions/${encodeURIComponent(market)}/${encodeURIComponent(symbol)}/industry-tag`, z.object({ restored: z.literal(true) }), {
    token, method: "DELETE",
  }).then(() => undefined);
}

export function runAgent(token: string): Promise<AgentRun> {
  return request("/v1/agent/runs", agentRunSchema, { token, method: "POST" });
}

export function importPortfolioXlsx(
  token: string,
  file: File,
  accountName: string,
): Promise<ImportResult> {
  const form = new FormData();
  form.set("file", file);
  if (accountName.trim()) form.set("accountName", accountName.trim());
  return request("/v1/imports/xlsx", importResponseSchema, {
    token,
    method: "POST",
    body: form,
  });
}

function errorMessage(status: number, code: string): string {
  const known: Record<string, string> = {
    invalid_phone: "请输入有效的中国大陆手机号。",
    invalid_credentials: "请检查手机号和 6 位验证码。",
    invalid_code: "请输入 6 位验证码。",
    invalid_or_expired_code: "验证码错误或已过期，请重新获取。",
    sms_unavailable: "短信服务暂时不可用。",
    unauthorized: "登录已失效，请重新登录。",
    auth_not_configured: "后端尚未配置手机号登录。",
    snapshot_not_found: "当前账号还没有持仓快照，请先导入 XLSX。",
    invalid_xlsx: "XLSX 文件未通过后端校验，请确认使用同花顺持仓导出文件。",
    invalid_industry_tag: "请输入 1–20 个字的标签名称，并选择有效颜色。",
    industry_tag_name_exists: "这个标签名称已经存在。",
    industry_tag_limit_reached: "最多只能创建 30 个行业标签。",
    industry_tag_not_found: "标签不存在或已删除，请刷新后重试。",
    position_not_found: "当前快照中找不到这条持仓，请刷新后重试。",
  };
  if (known[code]) return known[code];
  if (status === 429) return "操作过于频繁，请稍后再试。";
  if (status === 413) return "文件超过后端允许的 10 MiB。";
  if (status === 415) return "请选择 .xlsx 文件。";
  return `请求失败（HTTP ${status} · ${code}）。`;
}
