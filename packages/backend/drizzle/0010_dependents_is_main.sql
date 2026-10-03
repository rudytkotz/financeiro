-- Migration: adicionar campo is_main em dependents
-- Indica o dependente padrão do usuário (apenas um por usuário pode ser true)
ALTER TABLE "dependents" ADD COLUMN "is_main" boolean NOT NULL DEFAULT false;
