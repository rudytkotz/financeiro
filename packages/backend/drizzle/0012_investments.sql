-- Migration: tabelas de investimentos (renda fixa e variável)

CREATE TABLE IF NOT EXISTS "investments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar(20) NOT NULL,
  "ticker" varchar(20),
  "name" varchar(120) NOT NULL,
  "asset_class" varchar(20),
  "invested_amount" bigint,
  "application_date" date,
  "maturity_date" date,
  "rate_type" varchar(20),
  "rate_value" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "investments_user_id_idx" ON "investments" ("user_id");
CREATE INDEX IF NOT EXISTS "investments_ticker_idx" ON "investments" ("ticker");

CREATE TABLE IF NOT EXISTS "investment_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "investment_id" uuid NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
  "operation" varchar(10) NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" bigint NOT NULL,
  "fees" bigint NOT NULL DEFAULT 0,
  "date" date NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "investment_transactions_investment_id_idx" ON "investment_transactions" ("investment_id");
CREATE INDEX IF NOT EXISTS "investment_transactions_user_id_idx" ON "investment_transactions" ("user_id");
