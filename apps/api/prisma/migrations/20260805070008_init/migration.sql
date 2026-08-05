-- CreateEnum
CREATE TYPE "DataFreshness" AS ENUM ('fresh', 'stale', 'unknown');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('info', 'attention', 'risk');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('freshness', 'concentration', 'cash', 'change', 'note');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('snapshot', 'position', 'calculation', 'market');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "sourceAccountId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "currency" VARCHAR(16) NOT NULL DEFAULT 'CNY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snapshots" (
    "id" VARCHAR(255) NOT NULL,
    "accountId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceContractVersion" VARCHAR(64) NOT NULL DEFAULT 'tzzb-v1',
    "calculationVersion" VARCHAR(32) NOT NULL DEFAULT '1',
    "contentHash" VARCHAR(64) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceSyncedAt" TIMESTAMPTZ(3),
    "freshness" "DataFreshness" NOT NULL,
    "currency" VARCHAR(16) NOT NULL DEFAULT 'CNY',
    "totalAsset" DECIMAL(24,8) NOT NULL,
    "cash" DECIMAL(24,8) NOT NULL,
    "stockMarketValue" DECIMAL(24,8) NOT NULL,
    "dayProfit" DECIMAL(24,8),
    "dayProfitRate" DECIMAL(20,12),
    "positionRate" DECIMAL(20,12),
    "ingestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" VARCHAR(512) NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "symbol" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "market" VARCHAR(32) NOT NULL,
    "industry" VARCHAR(255),
    "quantity" DECIMAL(24,8) NOT NULL,
    "currentPrice" DECIMAL(24,8),
    "unitCost" DECIMAL(24,8),
    "marketValue" DECIMAL(24,8) NOT NULL,
    "portfolioWeight" DECIMAL(20,12),
    "dayProfit" DECIMAL(24,8),
    "dayProfitRate" DECIMAL(20,12),
    "holdingProfit" DECIMAL(24,8),
    "holdingProfitRate" DECIMAL(20,12),
    "holdingDays" INTEGER,
    "latestRate" DECIMAL(20,12),
    "relatedSector" VARCHAR(255),
    "sectorRate" DECIMAL(20,12),
    "combinationProfit" DECIMAL(24,8),
    "combinationRate" DECIMAL(20,12),
    "cumulativeProfit" DECIMAL(24,8),
    "cumulativeProfitRate" DECIMAL(20,12),
    "weekProfit" DECIMAL(24,8),
    "monthProfit" DECIMAL(24,8),
    "yearProfit" DECIMAL(24,8),
    "breakEvenRate" DECIMAL(20,12),
    "oneMonthRate" DECIMAL(20,12),
    "threeMonthRate" DECIMAL(20,12),
    "sixMonthRate" DECIMAL(20,12),
    "oneYearRate" DECIMAL(20,12),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" VARCHAR(512) NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "model" VARCHAR(255),
    "disclaimer" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_insights" (
    "id" VARCHAR(768) NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceInsightId" VARCHAR(512) NOT NULL,
    "category" "InsightCategory" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_evidence" (
    "id" VARCHAR(768) NOT NULL,
    "insightId" TEXT NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "referenceId" VARCHAR(512) NOT NULL,
    "label" VARCHAR(512) NOT NULL,
    "asOf" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_updatedAt_idx" ON "accounts"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_source_sourceAccountId_key" ON "accounts"("source", "sourceAccountId");

-- CreateIndex
CREATE INDEX "snapshots_accountId_capturedAt_idx" ON "snapshots"("accountId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "snapshots_capturedAt_idx" ON "snapshots"("capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "snapshots_accountId_capturedAt_key" ON "snapshots"("accountId", "capturedAt");

-- CreateIndex
CREATE INDEX "positions_snapshotId_marketValue_idx" ON "positions"("snapshotId", "marketValue" DESC);

-- CreateIndex
CREATE INDEX "positions_symbol_idx" ON "positions"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "positions_snapshotId_market_symbol_key" ON "positions"("snapshotId", "market", "symbol");

-- CreateIndex
CREATE INDEX "agent_runs_snapshotId_requestedAt_idx" ON "agent_runs"("snapshotId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "agent_insights_runId_idx" ON "agent_insights"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_insights_runId_sourceInsightId_key" ON "agent_insights"("runId", "sourceInsightId");

-- CreateIndex
CREATE INDEX "agent_evidence_insightId_idx" ON "agent_evidence"("insightId");

-- CreateIndex
CREATE INDEX "agent_evidence_referenceId_idx" ON "agent_evidence"("referenceId");

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_insights" ADD CONSTRAINT "agent_insights_runId_fkey" FOREIGN KEY ("runId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_evidence" ADD CONSTRAINT "agent_evidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "agent_insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
