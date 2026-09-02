-- Migration: adicionar campo color nas categorias
-- Armazena a cor como hex string (ex: '#ef4444'). Nullable para retrocompatibilidade.

ALTER TABLE "categories" ADD COLUMN "color" varchar(7);
