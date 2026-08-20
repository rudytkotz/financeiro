CREATE TABLE IF NOT EXISTS "telegram_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chat_id" varchar(50) NOT NULL UNIQUE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now()
);
