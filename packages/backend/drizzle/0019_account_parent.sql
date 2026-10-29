-- Migration: vincular cartão de crédito a uma conta pai (ex: cartão do Nubank
-- pertence à conta corrente Nubank). parent_account_id é opcional: um cartão
-- pode continuar independente, e contas não-cartão simplesmente não usam.

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "parent_account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "accounts_parent_id_idx" ON "accounts" ("parent_account_id");
