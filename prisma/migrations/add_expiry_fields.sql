-- Migration: add document expiry and reminder fields
-- Run this against your existing PostgreSQL database ONCE.
-- Safe to run on an existing database — uses IF NOT EXISTS / IF EXISTS guards.

-- Step 1: Add enum value (must run OUTSIDE a transaction)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXPIRY_REMINDER';

-- Step 2: Add new columns to Document
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "dateReceived"     DATE,
  ADD COLUMN IF NOT EXISTS "expiryDate"       DATE,
  ADD COLUMN IF NOT EXISTS "reminderSettings" JSONB,
  ADD COLUMN IF NOT EXISTS "reminderSent"     JSONB;

-- Step 3: Add index on expiryDate for fast reminder lookups
CREATE INDEX IF NOT EXISTS "Document_expiryDate_idx" ON "Document"("expiryDate");
