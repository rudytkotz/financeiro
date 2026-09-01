-- Migration: trocar o unique index global de dependents (lower(name))
-- por um unique index composto (lower(name), user_id), permitindo que
-- usuários diferentes tenham dependentes com o mesmo nome.

-- Remover o índice global antigo
DROP INDEX IF EXISTS "dependents_name_lower_idx";

-- Criar novo índice composto: unicidade dentro do mesmo usuário
-- NULL user_id (dependentes legados) continuam únicos entre si.
CREATE UNIQUE INDEX "dependents_name_user_lower_idx"
  ON "dependents" (lower("name"), "user_id");
