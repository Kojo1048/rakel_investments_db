-- =============================================================================
-- fix-document-relations.sql
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
--
-- Problem:
--   Document upload / document list queries fail with:
--     "Could not find the 'company' column of 'Document' in the schema cache"
--
--   The application code uses PostgREST embedded-resource syntax:
--     company:Company!Document_companyId_fkey(id, name)
--
--   This syntax requires PostgREST's schema cache to contain a FOREIGN KEY
--   constraint named exactly "Document_companyId_fkey" from
--   "Document"."companyId" -> "Company"."id".
--
--   If that constraint does not exist (was never created, dropped, or the
--   PostgREST schema cache is stale), PostgREST cannot resolve the embed and
--   falls back to treating "company" as a literal column name on "Document",
--   producing the exact error above.
--
-- This script:
--   1. Shows all current foreign keys on "Document" (diagnostic).
--   2. Creates the missing FK constraints (idempotent — skipped if present).
--   3. Forces PostgREST to reload its schema cache.
-- =============================================================================

-- ── 1. Diagnostic: list existing FKs on "Document" ───────────────────────────
SELECT
  conname                                   AS constraint_name,
  conrelid::regclass::text                  AS table_name,
  confrelid::regclass::text                 AS referenced_table,
  pg_get_constraintdef(oid)                 AS definition
FROM pg_constraint
WHERE conrelid = '"Document"'::regclass
  AND contype  = 'f';

-- ── 2. Create missing FK constraints (idempotent) ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_companyId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_serviceId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_serviceId_fkey"
      FOREIGN KEY ("serviceId") REFERENCES "Service"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_contractId_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_contractId_fkey"
      FOREIGN KEY ("contractId") REFERENCES "Contract"(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Document_uploadedBy_fkey'
  ) THEN
    ALTER TABLE "Document"
      ADD CONSTRAINT "Document_uploadedBy_fkey"
      FOREIGN KEY ("uploadedBy") REFERENCES "User"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 3. Reload PostgREST schema cache ──────────────────────────────────────────
-- Without this, PostgREST keeps using its cached (incomplete) schema even
-- after the constraints above are added, and the error will persist until
-- the cache naturally refreshes or the project restarts.
NOTIFY pgrst, 'reload schema';

-- ── 4. Verify — re-run the diagnostic from step 1 ─────────────────────────────
SELECT
  conname                                   AS constraint_name,
  conrelid::regclass::text                  AS table_name,
  confrelid::regclass::text                 AS referenced_table,
  pg_get_constraintdef(oid)                 AS definition
FROM pg_constraint
WHERE conrelid = '"Document"'::regclass
  AND contype  = 'f'
ORDER BY conname;
