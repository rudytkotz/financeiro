-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" varchar(50) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "is_admin" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Add user_id columns (nullable to not break existing data)
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id");
ALTER TABLE "dependents" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id");
ALTER TABLE "imports" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id");
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id");
ALTER TABLE "income" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "users"("id");

-- Remove unique constraint on imports.reference_month (now per-user)
ALTER TABLE "imports" DROP CONSTRAINT IF EXISTS "imports_reference_month_unique";

-- Remove unique constraint on income.month (now per-user)
ALTER TABLE "income" DROP CONSTRAINT IF EXISTS "income_month_unique";

-- Create admin user (password: admin, bcrypt hash)
INSERT INTO "users" ("username", "password_hash", "is_admin")
VALUES ('admin', '$2b$10$XNViRn5ayt5Y5EU0zZ2rVu7c9yMTzLMoLur5ST16D44DTL7q1dzWW', true)
ON CONFLICT ("username") DO NOTHING;
