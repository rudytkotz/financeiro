-- Migration: distinguir receita de despesa nas transações

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT 'despesa';

-- Índice para filtrar rapidamente por tipo (despesa/receita) dentro do mês/usuário
CREATE INDEX IF NOT EXISTS "transactions_kind_idx" ON "transactions" ("kind");
