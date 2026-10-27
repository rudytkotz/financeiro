-- Migration: contas/carteiras + vínculo opcional em transações

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(60) NOT NULL,
  "type" varchar(20) NOT NULL DEFAULT 'corrente',
  "initial_balance" bigint NOT NULL DEFAULT 0,
  "color" varchar(7),
  "closing_day" integer,
  "due_day" integer,
  "credit_limit" bigint,
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id");

-- Vínculo opcional de transação com conta
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id");
CREATE INDEX IF NOT EXISTS "transactions_account_id_idx" ON "transactions" ("account_id");
