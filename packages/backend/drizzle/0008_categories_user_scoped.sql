-- Migration: tornar categorias exclusivas por usuário
-- Remove o unique index global de name e cria um índice composto (lower(name), user_id)
-- permitindo que usuários diferentes tenham categorias com o mesmo nome.

-- Remover índice global antigo
DROP INDEX IF EXISTS "categories_name_lower_idx";

-- Novo índice composto: unicidade dentro do mesmo usuário (user_id NULL = global/seed)
CREATE UNIQUE INDEX "categories_name_user_lower_idx"
  ON "categories" (lower("name"), "user_id");
