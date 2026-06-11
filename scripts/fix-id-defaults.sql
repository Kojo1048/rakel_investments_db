-- =============================================================================
-- fix-id-defaults.sql
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
--
-- Problem:
--   Prisma's @default(cuid()) is CLIENT-SIDE — Prisma generates the ID in
--   application code before the INSERT.  The migration created every id column
--   as TEXT NOT NULL with NO PostgreSQL DEFAULT.  Now that we use the Supabase
--   JS client directly (which does not generate IDs), any INSERT that omits the
--   id column hits the NOT NULL constraint and fails with:
--     "null value in column 'id' … violates not-null constraint"
--
-- Fix:
--   Add DEFAULT gen_random_uuid() to every affected id column.
--   gen_random_uuid() is built into PostgreSQL 13+ (Supabase uses PG 15+);
--   no extension is needed.
--   Existing rows are NOT modified — only future INSERTs without an id benefit.
-- =============================================================================

ALTER TABLE "Contract"            ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "Invoice"             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "Document"            ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "OperationsRecord"    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "AuditLog"            ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "PendingRegistration" ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "User"                ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "Company"             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "Service"             ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "UserSession"         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE "AnalyticsRecord"     ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Verify (should show default_value = 'gen_random_uuid()' for every row)
SELECT
  table_name,
  column_name,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name   = 'id'
  AND table_name IN (
    'Contract','Invoice','Document','OperationsRecord','AuditLog',
    'PendingRegistration','User','Company','Service','UserSession',
    'AnalyticsRecord'
  )
ORDER BY table_name;
