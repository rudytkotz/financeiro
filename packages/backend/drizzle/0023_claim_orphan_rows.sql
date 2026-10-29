-- Migration: isolamento total por usuário.
-- Linhas legadas com user_id NULL (anteriores ao sistema de login) eram
-- visíveis a todos os usuários pelo padrão "user_id IS NULL" no código.
-- Atribuímos essas linhas ao usuário mais antigo (primeiro cadastrado).
--
-- Categorias e dependentes têm índice único por (lower(name), user_id); então
-- quando já existe um registro com o mesmo nome para o dono, remapeamos as
-- referências para o registro existente e removemos a linha órfã duplicada.

DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM "users" ORDER BY "created_at" ASC NULLS LAST, "id" ASC LIMIT 1;
  IF owner_id IS NULL THEN
    RETURN; -- sem usuários, nada a reatribuir
  END IF;

  -- ---- CATEGORIES ----
  -- 1) Remapear transações/orçamentos de categorias órfãs que colidem por nome
  --    com uma categoria já existente do dono, para a categoria existente.
  UPDATE "transactions" t
     SET "category_id" = existing.id
    FROM "categories" orphan
    JOIN "categories" existing
      ON lower(existing.name) = lower(orphan.name)
     AND existing.user_id = owner_id
   WHERE orphan.user_id IS NULL
     AND t.category_id = orphan.id;

  UPDATE "budgets" b
     SET "category_id" = existing.id
    FROM "categories" orphan
    JOIN "categories" existing
      ON lower(existing.name) = lower(orphan.name)
     AND existing.user_id = owner_id
   WHERE orphan.user_id IS NULL
     AND b.category_id = orphan.id;

  -- 2) Remover categorias órfãs duplicadas (já remapeadas acima)
  DELETE FROM "categories" orphan
   WHERE orphan.user_id IS NULL
     AND EXISTS (
       SELECT 1 FROM "categories" existing
        WHERE existing.user_id = owner_id
          AND lower(existing.name) = lower(orphan.name)
     );

  -- 3) Atribuir as categorias órfãs restantes (sem colisão) ao dono
  UPDATE "categories" SET "user_id" = owner_id WHERE "user_id" IS NULL;

  -- ---- DEPENDENTS ---- (mesmo tratamento de colisão por nome)
  UPDATE "transactions" t
     SET "dependent_id" = existing.id
    FROM "dependents" orphan
    JOIN "dependents" existing
      ON lower(existing.name) = lower(orphan.name)
     AND existing.user_id = owner_id
   WHERE orphan.user_id IS NULL
     AND t.dependent_id = orphan.id;

  DELETE FROM "dependents" orphan
   WHERE orphan.user_id IS NULL
     AND EXISTS (
       SELECT 1 FROM "dependents" existing
        WHERE existing.user_id = owner_id
          AND lower(existing.name) = lower(orphan.name)
     );

  UPDATE "dependents" SET "user_id" = owner_id WHERE "user_id" IS NULL;

  -- ---- Tabelas sem índice único por nome ----
  UPDATE "imports"      SET "user_id" = owner_id WHERE "user_id" IS NULL;
  UPDATE "transactions" SET "user_id" = owner_id WHERE "user_id" IS NULL;

  -- income tem unique (month, user)? não — mas pode haver duplicata month.
  -- Remove órfãs de income cujo mês já existe para o dono; atribui o resto.
  DELETE FROM "income" orphan
   WHERE orphan.user_id IS NULL
     AND EXISTS (
       SELECT 1 FROM "income" existing
        WHERE existing.user_id = owner_id
          AND existing.month = orphan.month
     );
  UPDATE "income" SET "user_id" = owner_id WHERE "user_id" IS NULL;
END $$;
