-- Existing data is assigned to an inactive placeholder. It is never returned by
-- authenticated APIs. A trusted collector upload can adopt its matching account.
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

INSERT INTO "users" ("id", "phone", "isActive", "createdAt", "updatedAt")
VALUES ('legacy-unassigned', NULL, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

CREATE TABLE "sms_verification_codes" (
    "id" VARCHAR(64) NOT NULL,
    "userId" TEXT,
    "phone" VARCHAR(32) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sms_verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
    "id" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "accounts" ADD COLUMN "userId" TEXT;
UPDATE "accounts" SET "userId" = 'legacy-unassigned' WHERE "userId" IS NULL;
ALTER TABLE "accounts" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "snapshots" ADD COLUMN "externalId" VARCHAR(255);
UPDATE "snapshots" SET "externalId" = "id" WHERE "externalId" IS NULL;
ALTER TABLE "snapshots" ALTER COLUMN "externalId" SET NOT NULL;

ALTER TABLE "agent_runs" ADD COLUMN "externalId" VARCHAR(512);
UPDATE "agent_runs" SET "externalId" = "id" WHERE "externalId" IS NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "externalId" SET NOT NULL;

DROP INDEX "accounts_source_sourceAccountId_key";

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "sms_verification_codes_phone_createdAt_idx" ON "sms_verification_codes"("phone", "createdAt" DESC);
CREATE INDEX "sms_verification_codes_expiresAt_idx" ON "sms_verification_codes"("expiresAt");
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");
CREATE INDEX "auth_sessions_userId_expiresAt_idx" ON "auth_sessions"("userId", "expiresAt" DESC);
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE UNIQUE INDEX "accounts_userId_source_sourceAccountId_key" ON "accounts"("userId", "source", "sourceAccountId");
CREATE INDEX "accounts_userId_updatedAt_idx" ON "accounts"("userId", "updatedAt");
CREATE UNIQUE INDEX "snapshots_accountId_externalId_key" ON "snapshots"("accountId", "externalId");
CREATE UNIQUE INDEX "agent_runs_snapshotId_externalId_key" ON "agent_runs"("snapshotId", "externalId");

ALTER TABLE "sms_verification_codes" ADD CONSTRAINT "sms_verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
