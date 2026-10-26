-- Migration: proventos, snapshots de patrimônio e metas de alocação

CREATE TABLE IF NOT EXISTS "investment_dividends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "investment_id" uuid NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
  "kind" varchar(15) NOT NULL DEFAULT 'dividendo',
  "amount" bigint NOT NULL,
  "date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "investment_dividends_investment_id_idx" ON "investment_dividends" ("investment_id");
CREATE INDEX IF NOT EXISTS "investment_dividends_user_id_idx" ON "investment_dividends" ("user_id");

CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "month" varchar(7) NOT NULL,
  "total_invested" bigint NOT NULL,
  "total_current" bigint NOT NULL,
  "renda_variavel" bigint NOT NULL DEFAULT 0,
  "renda_fixa" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_snapshots_month_user_idx" ON "portfolio_snapshots" ("month", "user_id");

CREATE TABLE IF NOT EXISTS "allocation_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_class" varchar(20) NOT NULL,
  "target_pct" integer NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "allocation_targets_class_user_idx" ON "allocation_targets" ("asset_class", "user_id");
