/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Guards behind NEXT_RUNTIME === 'nodejs' so it never runs in the Edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ── 1. Ensure built-in system accounts ───────────────────────────────
    try {
      const { ensureDefaultAccounts } = await import('./lib/init-db');
      await ensureDefaultAccounts();
    } catch (err) {
      console.error('[instrumentation] Could not verify default accounts:', err);
    }

    // ── 2. Seed companies (Rakel Investments guaranteed to exist) ─────────
    try {
      const { seedCompanies }     = await import('./lib/system/seedCompanies');
      const { ensureSystemCompany } = await import('./lib/system/initSystem');
      await seedCompanies();
      await ensureSystemCompany();
    } catch (err) {
      console.error('[instrumentation] Company seed failed (non-fatal):', err);
    }

    // ── 2. Document expiry reminder check ─────────────────────────────────
    const runReminderCheck = async () => {
      try {
        const { checkDocumentReminders } = await import('./lib/reminders');
        await checkDocumentReminders();
      } catch (err) {
        console.error('[instrumentation] Reminder check failed:', err);
      }
    };

    // Run once on startup, then every hour
    await runReminderCheck();

// Disabled during development
if (process.env.NODE_ENV === 'production') {
  setInterval(runReminderCheck, 60 * 60 * 1000);
}
  }
}
