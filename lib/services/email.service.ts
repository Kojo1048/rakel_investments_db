import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM ?? 'noreply@rakelinvestments.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function sendApprovalEmail(to: string, fullName: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping approval email to', to);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: 'Account Approved — Rakel Investments',
      text: [
        `Dear ${fullName},`,
        '',
        'You have been approved for entry. You may now log in.',
        '',
        `Login here: ${APP_URL}`,
        '',
        'Best regards,',
        'Rakel Investments Administration',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#1a1a2e">Account Approved</h2>
          <p>Dear <strong>${fullName}</strong>,</p>
          <p>You have been <strong>approved for entry</strong> to the Rakel Investments internal system.</p>
          <p>You may now log in using your registered credentials.</p>
          <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none">
            Log In Now
          </a>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="color:#6b7280;font-size:12px">Rakel Investments — Internal Database Management System</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send approval email:', err);
  }
}

export async function sendDeclineEmail(to: string, fullName: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping decline email to', to);
    return;
  }

  try {
    await transporter.sendMail({
      from: FROM,
      to,
      subject: 'Registration Status — Rakel Investments',
      text: [
        `Dear ${fullName},`,
        '',
        'You have been rejected. Please register again with correct credentials.',
        '',
        `Registration page: ${APP_URL}`,
        '',
        'If you believe this is a mistake, please contact your company administrator.',
        '',
        'Best regards,',
        'Rakel Investments Administration',
      ].join('\n'),
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#1a1a2e">Registration Not Approved</h2>
          <p>Dear <strong>${fullName}</strong>,</p>
          <p>Your registration request has been <strong>declined</strong>.</p>
          <p>Please register again with correct credentials, or contact your company administrator for assistance.</p>
          <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6b7280;color:#fff;border-radius:6px;text-decoration:none">
            Register Again
          </a>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="color:#6b7280;font-size:12px">Rakel Investments — Internal Database Management System</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send decline email:', err);
  }
}
