-- Migration: vincular um investimento a uma conta/corretora (ex: ativo
-- custodiado na corretora X). Opcional e com SET NULL para não quebrar o ativo
-- se a conta for removida. Permite "investir em mais de uma conta".

ALTER TABLE "investments"
  ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "investments_account_id_idx" ON "investments" ("account_id");
