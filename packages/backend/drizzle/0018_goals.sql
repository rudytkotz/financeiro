-- Migration: metas financeiras e aportes

CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(80) NOT NULL,
  "target_amount" bigint NOT NULL,
  "current_amount" bigint NOT NULL DEFAULT 0,
  "target_date" date,
  "color" varchar(7),
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "goals_user_id_idx" ON "goals" ("user_id");

CREATE TABLE IF NOT EXISTS "goal_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
  "amount" bigint NOT NULL,
  "date" date NOT NULL,
  "note" varchar(120),
  "created_at" timestamp with time zone DEFAULT now(),
  "user_id" uuid NOT NULL REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "goal_contributions_goal_id_idx" ON "goal_contributions" ("goal_id");
