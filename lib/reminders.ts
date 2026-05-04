/**
 * Document expiry reminder engine.
 * Called on server startup and every hour via instrumentation.ts.
 *
 * For each document with an expiryDate and reminderSettings:
 *   - For each selected interval, check if we are within that window
 *   - If yes and the reminder has not been sent yet → create AuditLog notification + mark sent
 */

import type { ReminderInterval } from './types';

// How many ms before expiry each interval represents
const INTERVAL_MS: Record<ReminderInterval, number> = {
  '1_MONTH': 30 * 24 * 60 * 60 * 1000,
  '2_WEEKS': 14 * 24 * 60 * 60 * 1000,
  '1_WEEK':   7 * 24 * 60 * 60 * 1000,
  '2_DAYS':   2 * 24 * 60 * 60 * 1000,
  '3_HOURS':      3 * 60 * 60 * 1000,
};

const INTERVAL_LABEL: Record<ReminderInterval, string> = {
  '1_MONTH': '1 month',
  '2_WEEKS': '2 weeks',
  '1_WEEK':  '1 week',
  '2_DAYS':  '2 days',
  '3_HOURS': '3 hours',
};

export async function checkDocumentReminders(): Promise<void> {
  const { db } = await import('./db/index');
  const now = new Date();

  // Only fetch documents that have an expiry date and reminder settings configured
  const docs = await db.document.findMany({
    where: {
      expiryDate:       { not: null },
      reminderSettings: { not: null },
      isArchived:       false,
    },
    select: {
      id:               true,
      title:            true,
      expiryDate:       true,
      reminderSettings: true,
      reminderSent:     true,
      companyId:        true,
      uploadedBy:       true,
    },
  });

  let created = 0;

  for (const doc of docs) {
    if (!doc.expiryDate) continue;

    const settings  = (doc.reminderSettings  as ReminderInterval[] | null) ?? [];
    const sent      = (doc.reminderSent       as Partial<Record<ReminderInterval, string>> | null) ?? {};
    const expiryMs  = new Date(doc.expiryDate).getTime();
    const msToExpiry = expiryMs - now.getTime();

    for (const interval of settings) {
      const windowMs = INTERVAL_MS[interval];
      if (!windowMs) continue;

      // Fire when we are within the reminder window AND haven't sent it yet
      const alreadySent = Boolean(sent[interval]);
      if (msToExpiry <= windowMs && !alreadySent) {
        const daysRemaining = Math.max(0, Math.ceil(msToExpiry / (1000 * 60 * 60 * 24)));
        const expiryStr     = new Date(doc.expiryDate).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        });

        try {
          // Create notification via AuditLog (surfaced by /api/v1/notifications)
          await db.auditLog.create({
            data: {
              userId:       doc.uploadedBy,
              username:     'system',
              action:       'DOCUMENT_EXPIRY_REMINDER',
              details:      `Document "${doc.title}" expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${expiryStr})`,
              targetEntity: doc.title,
              companyId:    doc.companyId ?? undefined,
              metadata:     { interval, expiryDate: doc.expiryDate, documentId: doc.id },
            },
          });

          // Mark this interval as sent so it doesn't fire again
          await db.document.update({
            where: { id: doc.id },
            data: {
              reminderSent: { ...sent, [interval]: now.toISOString() },
            },
          });

          created++;
          console.log(
            `[reminders] ✓ ${interval} reminder for "${doc.title}" ` +
            `(expires ${expiryStr}, ${daysRemaining}d remaining)`
          );
        } catch (err) {
          console.error(`[reminders] Failed to send reminder for ${doc.id}:`, err);
        }
      }
    }
  }

  if (created > 0) {
    console.log(`[reminders] Created ${created} document expiry reminder(s)`);
  }
}
