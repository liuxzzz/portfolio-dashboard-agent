import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
];
const envFile = envCandidates.find((candidate) => existsSync(candidate));
if (envFile) loadEnvFile(envFile);

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? "127.0.0.1";
const app = createApp();

serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(`portfolio-api listening on http://${hostname}:${info.port}`);
});
