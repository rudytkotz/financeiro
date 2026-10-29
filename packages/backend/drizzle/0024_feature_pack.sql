-- Migration: pacote de funcionalidades
--  - metas ligadas a uma conta (puxa saldo real)
--  - renda/salário por conta
--  - soft delete de transações (lixeira)
--  - tags livres por transação
--  - anexo/comprovante por transação

ALTER TABLE "goals"
  ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;

ALTER TABLE "income"
  ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "tags" text,
  ADD COLUMN IF NOT EXISTS "attachment_url" text,
  ADD COLUMN IF NOT EXISTS "attachment_name" varchar(255);

CREATE INDEX IF NOT EXISTS "transactions_deleted_at_idx" ON "transactions" ("deleted_at");
CREATE INDEX IF NOT EXISTS "goals_account_id_idx" ON "goals" ("account_id");
