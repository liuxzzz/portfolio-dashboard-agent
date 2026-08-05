import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createPrismaClient } from "./prisma.js";
import { PrismaPortfolioRepository } from "./prisma-repository.js";
import { PortfolioIndustryService } from "./industry.js";
import { TushareIndustryProvider } from "./tushare-industry-provider.js";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
];
const envFile = envCandidates.find((candidate) => existsSync(candidate));
if (envFile) loadEnvFile(envFile);

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? "127.0.0.1";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL 未配置，无法启动 Portfolio API");
}
const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaPortfolioRepository(prisma);
await repository.healthCheck();
const tushareToken = process.env.TUSHARE_TOKEN?.trim();
const tushareApiUrl = process.env.TUSHARE_API_URL?.trim();
const industryProvider = tushareToken
  ? new TushareIndustryProvider(
      tushareToken,
      tushareApiUrl ? { apiUrl: tushareApiUrl } : {},
    )
  : undefined;
const industryService = new PortfolioIndustryService(
  repository,
  industryProvider,
);
const app = createApp({ repository, industryService });

const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`portfolio-api listening on http://${hostname}:${info.port}`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  await prisma.$disconnect();
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
