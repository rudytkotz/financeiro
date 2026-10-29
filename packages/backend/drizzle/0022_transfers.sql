-- Migration: transferências entre contas.
-- Uma transferência gera duas transações (saída na origem, entrada no destino)
-- pareadas por transfer_id. O kind 'transferencia' mantém esses lançamentos
-- fora dos totais de despesas/receitas nos relatórios.

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "transfer_id" uuid;

CREATE INDEX IF NOT EXISTS "transactions_transfer_id_idx" ON "transactions" ("transfer_id");
