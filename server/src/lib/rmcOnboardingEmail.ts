import nodemailer from 'nodemailer';
import { getSmtpConfig } from './email.js';

export async function sendRmcPlantOnboardingInvite(input: {
  toEmail: string;
  plantName: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    console.warn('[rmc-onboarding] SMTP is not configured; invitation stored but email was not sent.');
    return false;
  }
  const port = Number.parseInt(cfg.port || '587', 10);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const from = cfg.from || cfg.user;
  const expiry = input.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  await transporter.sendMail({
    from,
    to: input.toEmail,
    subject: `Claim and onboard ${input.plantName} on TrackMyRMC`,
    text: [
      `You have been invited to onboard ${input.plantName} on TrackMyRMC.`,
      '',
      `Open this secure invitation: ${input.inviteUrl}`,
      `The invitation expires on ${expiry}.`,
      '',
      'The plant will remain unpublished until TrackMyRMC Super Admin verification and activation are complete.',
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px">
      <h2 style="color:#0f766e">TrackMyRMC Plant Onboarding</h2>
      <p>You have been invited to claim and onboard <strong>${escapeHtml(input.plantName)}</strong>.</p>
      <p><a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#0f766e;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Open secure invitation</a></p>
      <p style="color:#6b7280">Expires: ${escapeHtml(expiry)}</p>
      <p style="color:#6b7280;font-size:13px">The listing remains private until verification, activation and publication by a TrackMyRMC Super Admin.</p>
    </div>`,
  });
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char] ?? char);
}
