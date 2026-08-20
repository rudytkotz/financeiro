ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reference_month" varchar(7);

-- Backfill: for imported transactions, use the import's reference_month
UPDATE "transactions" t
SET "reference_month" = i."reference_month"
FROM "imports" i
WHERE t."import_id" = i."id" AND t."reference_month" IS NULL;

-- Backfill: for manual/standalone transactions, derive from date
UPDATE "transactions"
SET "reference_month" = substring("date"::text from 1 for 7)
WHERE "reference_month" IS NULL;

-- Index for fast month filtering
CREATE INDEX IF NOT EXISTS "transactions_reference_month_idx" ON "transactions" ("reference_month");
