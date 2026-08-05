-- CreateTable
CREATE TABLE "security_industry_memberships" (
    "id" VARCHAR(64) NOT NULL,
    "taxonomy" VARCHAR(32) NOT NULL,
    "market" VARCHAR(32) NOT NULL,
    "symbol" VARCHAR(64) NOT NULL,
    "level1Code" VARCHAR(32) NOT NULL,
    "level1Name" VARCHAR(255) NOT NULL,
    "level2Code" VARCHAR(32),
    "level2Name" VARCHAR(255),
    "level3Code" VARCHAR(32),
    "level3Name" VARCHAR(255),
    "effectiveFrom" TIMESTAMPTZ(3),
    "effectiveTo" TIMESTAMPTZ(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(64) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "security_industry_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_market_bars" (
    "id" VARCHAR(64) NOT NULL,
    "taxonomy" VARCHAR(32) NOT NULL,
    "industryCode" VARCHAR(32) NOT NULL,
    "industryName" VARCHAR(255) NOT NULL,
    "tradeDate" TIMESTAMPTZ(3) NOT NULL,
    "close" DECIMAL(24,8),
    "pctChange" DECIMAL(20,12),
    "source" VARCHAR(64) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "industry_market_bars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_industry_memberships_taxonomy_market_symbol_effectiveFrom_idx" ON "security_industry_memberships"("taxonomy", "market", "symbol", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "security_industry_memberships_taxonomy_level1Code_isCurrent_idx" ON "security_industry_memberships"("taxonomy", "level1Code", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "industry_market_bars_taxonomy_industryCode_tradeDate_key" ON "industry_market_bars"("taxonomy", "industryCode", "tradeDate");

-- CreateIndex
CREATE INDEX "industry_market_bars_taxonomy_industryCode_tradeDate_idx" ON "industry_market_bars"("taxonomy", "industryCode", "tradeDate" DESC);
