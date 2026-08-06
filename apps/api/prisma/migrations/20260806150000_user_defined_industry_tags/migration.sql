CREATE TABLE "industry_tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "industry_tags_pkey" PRIMARY KEY ("id")
);

-- Preserve existing manual classifications by turning every used system label
-- into a private label owned by the account's user.
INSERT INTO "industry_tags" (
    "id", "userId", "name", "color", "sortOrder", "createdAt", "updatedAt"
)
SELECT DISTINCT
    CONCAT('migrated:', a."userId", ':', mi."id"),
    a."userId",
    mi."name",
    mi."color",
    mi."sortOrder",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "security_industry_overrides" sio
JOIN "accounts" a ON a."id" = sio."accountId"
JOIN "main_industries" mi ON mi."id" = sio."mainIndustryId";

ALTER TABLE "security_industry_overrides" ADD COLUMN "tagId" TEXT;

UPDATE "security_industry_overrides" sio
SET "tagId" = CONCAT('migrated:', a."userId", ':', sio."mainIndustryId")
FROM "accounts" a
WHERE a."id" = sio."accountId";

ALTER TABLE "security_industry_overrides" DROP CONSTRAINT "security_industry_overrides_mainIndustryId_fkey";
DROP INDEX "security_industry_overrides_mainIndustryId_idx";
ALTER TABLE "security_industry_overrides" ALTER COLUMN "tagId" SET NOT NULL;
ALTER TABLE "security_industry_overrides" DROP COLUMN "mainIndustryId";

CREATE UNIQUE INDEX "industry_tags_userId_name_key" ON "industry_tags"("userId", "name");
CREATE INDEX "industry_tags_userId_sortOrder_idx" ON "industry_tags"("userId", "sortOrder");
CREATE INDEX "security_industry_overrides_tagId_idx" ON "security_industry_overrides"("tagId");

ALTER TABLE "industry_tags" ADD CONSTRAINT "industry_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_industry_overrides" ADD CONSTRAINT "security_industry_overrides_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "industry_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "main_industries";
