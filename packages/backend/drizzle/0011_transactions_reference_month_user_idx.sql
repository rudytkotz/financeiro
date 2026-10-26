-- Migration: índice composto para queries de listagem de transações por mês+usuário
-- A query mais frequente do sistema filtra exatamente por (referenceMonth, userId)
CREATE INDEX IF NOT EXISTS "transactions_reference_month_user_idx"
  ON "transactions" ("reference_month", "user_id");
