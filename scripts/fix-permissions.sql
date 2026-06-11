-- ============================================================
-- fix-permissions.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- to grant the required permissions to the Supabase roles.
--
-- Why this is needed:
--   Tables created via Prisma migrations are owned by the
--   "postgres" role but are NOT automatically granted to the
--   Supabase built-in roles (service_role, authenticated, anon).
--   This causes "permission denied for table X" errors even when
--   using the service_role key, which bypasses RLS but still
--   requires PostgreSQL-level GRANT on each table.
-- ============================================================

-- 1. Grant schema usage so all three roles can see the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant full access on all EXISTING tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Grant full access on all EXISTING sequences (needed for auto-increment/uuid defaults)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- 4. Set DEFAULT PRIVILEGES so future tables/sequences also get grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon;

-- 5. Enable RLS on all tables (best practice — service_role bypasses it)
--    Uncomment if you want RLS enabled:
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
--     EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY';
--   END LOOP;
-- END $$;

-- 6. Verify grants were applied (run SELECT to confirm)
SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;
