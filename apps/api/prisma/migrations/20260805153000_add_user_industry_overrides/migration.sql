CREATE TABLE "main_industries" (
    "id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "main_industries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_industry_overrides" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "market" VARCHAR(32) NOT NULL,
    "symbol" VARCHAR(64) NOT NULL,
    "mainIndustryId" VARCHAR(32) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "security_industry_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "main_industries_name_key" ON "main_industries"("name");
CREATE INDEX "main_industries_isActive_sortOrder_idx" ON "main_industries"("isActive", "sortOrder");
CREATE UNIQUE INDEX "security_industry_overrides_accountId_market_symbol_key" ON "security_industry_overrides"("accountId", "market", "symbol");
CREATE INDEX "security_industry_overrides_mainIndustryId_idx" ON "security_industry_overrides"("mainIndustryId");

ALTER TABLE "security_industry_overrides"
ADD CONSTRAINT "security_industry_overrides_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "security_industry_overrides"
ADD CONSTRAINT "security_industry_overrides_mainIndustryId_fkey"
FOREIGN KEY ("mainIndustryId") REFERENCES "main_industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "main_industries" ("id", "name", "color", "sortOrder", "updatedAt") VALUES
    ('semiconductor', '半导体', '#172033', 0, CURRENT_TIMESTAMP),
    ('internet', '互联网', '#5BC5A7', 1, CURRENT_TIMESTAMP),
    ('smart-driving', '智能驾驶', '#F3B45A', 2, CURRENT_TIMESTAMP),
    ('commercial-space', '商业航天', '#7C8BE8', 3, CURRENT_TIMESTAMP),
    ('healthcare', '医药', '#D96C8B', 4, CURRENT_TIMESTAMP),
    ('banking', '银行', '#8B98A9', 5, CURRENT_TIMESTAMP);
