-- Migration: transações recorrentes / contas a pagar e receber

CREATE TABLE IF NOT EXISTS "recurring_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "description" varchar(255) NOT NULL,
  "amount" bigint NOT NULL,
  "kind" varchar(10) NOT NULL DEFAULT 'despesa',
  "category_id" uuid REFERENCES "categories"("id"),
  "account_id" uuid REFERENCES "accounts"("id"),
  "dependent_id" uuid REFERENCES "dependents"("id"),
  "payment_method" varchar(20) NOT NULL DEFAULT 'credito',
  "day_of_month" integer NOT NULL,
  "start_month" varchar(7) NOT NULL,
  "end_month" varchar(7),
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "recurring_transactions_user_id_idx" ON "recurring_transactions" ("user_id");

-- Vínculo da transação gerada com seu modelo recorrente
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "recurring_id" uuid;
CREATE INDEX IF NOT EXISTS "transactions_recurring_id_idx" ON "transactions" ("recurring_id");
