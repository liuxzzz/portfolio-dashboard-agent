import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const envSchema = z.object({
  TZZB_BASE_URL: z.url().default("https://tzzb.10jqka.com.cn"),
  TZZB_PROFILE_DIR: optionalText,
  TZZB_BROWSER_CHANNEL: z.string().default("chrome"),
  TZZB_CHROME_EXECUTABLE: optionalText,
  TZZB_HEADLESS: z.enum(["true", "false"]).default("true"),
  TZZB_USER_ID: optionalText,
  TZZB_ACCOUNT_IDS: optionalText,
  TZZB_RATE_UNIT: z.enum(["percent", "decimal"]).default("percent"),
  TZZB_CDP_URL: optionalUrl,
  PORTFOLIO_API_URL: optionalUrl,
  INGEST_SHARED_SECRET: optionalText,
  PORTFOLIO_USER_PHONE: optionalText,
});

export function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ];
  const envFile = candidates.find((candidate) => existsSync(candidate));
  if (envFile) loadEnvFile(envFile);
}

export function loadCollectorConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.parse(env);
  const apiConfigured = Boolean(
    parsed.PORTFOLIO_API_URL &&
      parsed.INGEST_SHARED_SECRET &&
      parsed.PORTFOLIO_USER_PHONE,
  );
  const uploadConfigCount = [
    parsed.PORTFOLIO_API_URL,
    parsed.INGEST_SHARED_SECRET,
    parsed.PORTFOLIO_USER_PHONE,
  ].filter(Boolean).length;
  if (uploadConfigCount !== 0 && uploadConfigCount !== 3) {
    throw new Error(
      "PORTFOLIO_API_URL、INGEST_SHARED_SECRET 与 PORTFOLIO_USER_PHONE 必须同时配置或同时留空",
    );
  }

  return {
    baseUrl: parsed.TZZB_BASE_URL,
    profileDir:
      parsed.TZZB_PROFILE_DIR ??
      path.resolve(process.cwd(), "browser-profile", "tzzb"),
    browserChannel: parsed.TZZB_BROWSER_CHANNEL,
    chromeExecutable: parsed.TZZB_CHROME_EXECUTABLE,
    headless: parsed.TZZB_HEADLESS === "true",
    userId: parsed.TZZB_USER_ID,
    accountIds: parsed.TZZB_ACCOUNT_IDS
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    rateUnit: parsed.TZZB_RATE_UNIT,
    cdpUrl: parsed.TZZB_CDP_URL,
    apiConfigured,
    apiUrl: parsed.PORTFOLIO_API_URL,
    ingestSharedSecret: parsed.INGEST_SHARED_SECRET,
    portfolioUserPhone: parsed.PORTFOLIO_USER_PHONE,
  };
}
