-- Migration: add staffModules to User and PendingRegistration
-- Run once against your existing PostgreSQL database.
-- Safe to run multiple times — uses IF NOT EXISTS.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "staffModules" JSONB;

ALTER TABLE "PendingRegistration"
  ADD COLUMN IF NOT EXISTS "staffModules" JSONB;
