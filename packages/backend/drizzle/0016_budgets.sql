-- Migration: orçamento (teto) por categoria por mês

CREATE TABLE IF NOT EXISTS "budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
  "month" varchar(7) NOT NULL,
  "amount" bigint NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "budgets_category_month_user_idx" ON "budgets" ("category_id", "month", "user_id");
CREATE INDEX IF NOT EXISTS "budgets_user_month_idx" ON "budgets" ("user_id", "month");
