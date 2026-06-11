// lib/db/index.ts
// Service-role Supabase client — bypasses RLS for all server-side operations.
import { createClient } from '@supabase/supabase-js';

const globalForSupabase = globalThis as unknown as {
  supabaseDb: ReturnType<typeof createClient> | undefined;
};

export const db =
  globalForSupabase.supabaseDb ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseDb = db;
}
