-- ============================================================
-- Migration: 0000_initial_schema
-- Generated manually from schema.ts (no live DB available)
-- ============================================================

-- Enable pgcrypto for gen_random_uuid() (PostgreSQL < 13 fallback)
-- PostgreSQL 13+ has gen_random_uuid() built-in; this is a no-op on newer versions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "categories" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"       VARCHAR(50) NOT NULL,
  "is_default" BOOLEAN     NOT NULL DEFAULT FALSE,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Case-insensitive unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_lower_idx"
  ON "categories" (lower("name"));

-- ------------------------------------------------------------
-- dependents
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "dependents" (
  "id"   UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(50) NOT NULL,
  CONSTRAINT "dependents_pkey" PRIMARY KEY ("id")
);

-- Case-insensitive unique index on name
CREATE UNIQUE INDEX IF NOT EXISTS "dependents_name_lower_idx"
  ON "dependents" (lower("name"));

-- ------------------------------------------------------------
-- imports  (must exist before transactions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "imports" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "reference_month"   VARCHAR(7)   NOT NULL,
  "imported_at"       TIMESTAMPTZ  NOT NULL,
  "transaction_count" INTEGER      NOT NULL,
  CONSTRAINT "imports_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "imports_reference_month_unique" UNIQUE ("reference_month")
);

-- ------------------------------------------------------------
-- transactions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "transactions" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "date"         DATE          NOT NULL,
  "description"  VARCHAR(255)  NOT NULL,
  "amount"       BIGINT        NOT NULL,
  "category_id"  UUID          NOT NULL,
  "dependent_id" UUID,
  "source"       VARCHAR(10)   NOT NULL,
  "import_id"    UUID,
  "created_at"   TIMESTAMPTZ   DEFAULT now(),
  "updated_at"   TIMESTAMPTZ   DEFAULT now(),
  CONSTRAINT "transactions_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "transactions_category_fk" FOREIGN KEY ("category_id")  REFERENCES "categories"("id"),
  CONSTRAINT "transactions_dependent_fk" FOREIGN KEY ("dependent_id") REFERENCES "dependents"("id"),
  CONSTRAINT "transactions_import_fk"   FOREIGN KEY ("import_id")    REFERENCES "imports"("id")
);

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS "transactions_date_idx"
  ON "transactions" ("date");

CREATE INDEX IF NOT EXISTS "transactions_category_id_idx"
  ON "transactions" ("category_id");

CREATE INDEX IF NOT EXISTS "transactions_dependent_id_idx"
  ON "transactions" ("dependent_id");

CREATE INDEX IF NOT EXISTS "transactions_import_id_idx"
  ON "transactions" ("import_id");

-- ------------------------------------------------------------
-- income
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "income" (
  "id"     UUID       NOT NULL DEFAULT gen_random_uuid(),
  "month"  VARCHAR(7) NOT NULL,
  "amount" BIGINT     NOT NULL,
  CONSTRAINT "income_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "income_month_unique" UNIQUE ("month")
);
