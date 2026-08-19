-- Migration: 0001_add_installment_fields
-- Adds installment tracking and portador fields to transactions

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "portador" VARCHAR(100);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installment_current" INTEGER;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "installment_total" INTEGER;
