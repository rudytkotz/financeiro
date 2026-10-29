-- Migration: atrelar uma conta a um dependente (ex: a conta/cartão do filho).
-- Opcional, com SET NULL para não quebrar a conta se o dependente for removido.

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "dependent_id" uuid REFERENCES "dependents"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "accounts_dependent_id_idx" ON "accounts" ("dependent_id");
