// lib/reminders.ts
// Confirmed against "Document" table:
//   quoted columns: "expiryDate","reminderSettings","reminderSent","companyId","uploadedBy","isArchived"
// Confirmed against "AuditLog" table:
//   quoted columns: "userId","targetEntity","companyId"
import { randomUUID } from 'crypto';
import type { ReminderInterval } from './types';

const INTERVAL_MS: Record<ReminderInterval, number> = {
  '1_MONTH': 30 * 24 * 60 * 60 * 1000,
  '2_WEEKS': 14 * 24 * 60 * 60 * 1000,
  '1_WEEK':   7 * 24 * 60 * 60 * 1000,
  '2_DAYS':   2 * 24 * 60 * 60 * 1000,
  '3_HOURS':      3 * 60 * 60 * 1000,
};

export async function checkDocumentReminders(): Promise<void> {
  const { db } = await import('./db/index');
  const now = new Date();

  const { data: docs, error } = await db
    .from('Document')
    .select('id, title, expiryDate, reminderSettings, reminderSent, companyId, uploadedBy')
    .not('expiryDate', 'is', null)
    .not('reminderSettings', 'is', null)
    .eq('isArchived', false);

  if (error) {
    console.error('[reminders] Failed to fetch documents:', error);
    return;
  }

  let created = 0;

  for (const doc of docs ?? []) {
    if (!doc.expiryDate) continue;

    const settings   = (doc.reminderSettings  as ReminderInterval[] | null) ?? [];
    const sent       = (doc.reminderSent       as Partial<Record<ReminderInterval, string>> | null) ?? {};
    const msToExpiry = new Date(doc.expiryDate).getTime() - now.getTime();

    for (const interval of settings) {
      const windowMs = INTERVAL_MS[interval];
      if (!windowMs || sent[interval]) continue;

      if (msToExpiry <= windowMs) {
        const daysRemaining = Math.max(0, Math.ceil(msToExpiry / (1000 * 60 * 60 * 24)));
        const expiryStr = new Date(doc.expiryDate).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        });

        try {
          const { error: auditErr } = await db.from('AuditLog').insert({
            id:           randomUUID(),
            userId:       doc.uploadedBy,
            username:     'system',
            action:       'DOCUMENT_EXPIRY_REMINDER',
            details:      `Document "${doc.title}" expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${expiryStr})`,
            targetEntity: doc.title,
            companyId:    doc.companyId ?? undefined,
            metadata:     { interval, expiryDate: doc.expiryDate, documentId: doc.id },
          });
          if (auditErr) throw auditErr;

          const { error: updErr } = await db
            .from('Document')
            .update({ reminderSent: { ...sent, [interval]: now.toISOString() } })
            .eq('id', doc.id);
          if (updErr) throw updErr;

          created++;
          console.log(`[reminders] ✓ ${interval} reminder for "${doc.title}" (${daysRemaining}d remaining)`);
        } catch (err) {
          console.error(`[reminders] Failed to send reminder for ${doc.id}:`, err);
        }
      }
    }
  }

  if (created > 0) console.log(`[reminders] Created ${created} document expiry reminder(s)`);
}
