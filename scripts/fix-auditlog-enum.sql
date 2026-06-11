-- =============================================================================
-- fix-auditlog-enum.sql
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
--
-- Problem:
--   lib/reminders.ts inserts AuditLog rows with action = 'DOCUMENT_EXPIRY_REMINDER'.
--   app/api/v1/notifications/route.ts also lists 'DOCUMENT_EXPIRY_REMINDER' as a
--   valid notification action.
--
--   The "AuditAction" enum type in the database does not contain this value,
--   so the insert in lib/reminders.ts fails with:
--     invalid input value for enum "AuditAction": "DOCUMENT_EXPIRY_REMINDER"
--
-- Fix:
--   Add the missing value to the enum. ALTER TYPE ... ADD VALUE cannot run
--   inside a transaction block together with other statements, so it is its
--   own statement here.
-- =============================================================================

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DOCUMENT_EXPIRY_REMINDER';

-- Verify
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'public."AuditAction"'::regtype
ORDER BY enumsortorder;
