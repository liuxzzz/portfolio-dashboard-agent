import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "prisma/config";

const envFile = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
].find((candidate) => existsSync(candidate));

if (envFile) loadEnvFile(envFile);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://portfolio:portfolio@127.0.0.1:5433/portfolio?schema=public",
  },
});
