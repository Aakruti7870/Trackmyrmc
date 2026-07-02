import nodemailer from 'nodemailer';
import { getSmtpConfig } from './email.js';

// One generic, branded email used by every automation. Kept in its OWN module
// (not email.ts) on purpose: many test suites stub '../lib/email.js' with a
// fixed export list, and growing that module's surface breaks those stubs.
// Best-effort like every other notification sender: returns false instead of
// throwing when SMTP is not configured or the send fails.
export interface AutomationEmail {
  to: string[];
  subject: string;
  heading: string;
  /** Plain sentences/bullets rendered as paragraphs, in order. */
  lines: string[];
  /** Optional call-to-action link rendered as a button. */
  ctaUrl?: string;
  ctaLabel?: string;
}

export async function sendAutomationEmail(msg: AutomationEmail): Promise<boolean> {
  const recipients = msg.to.map(t => t.trim()).filter(Boolean);
  if (recipients.length === 0) return false;

  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    console.log(`[automation] (email not configured) would send "${msg.subject}" to ${recipients.join(', ')}`);
    return false;
  }

  const port = parseInt(cfg.port || '587', 10);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const paragraphs = msg.lines
    .map(l => `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(l)}</p>`)
    .join('');
  const cta = msg.ctaUrl
    ? `<p style="margin:20px 0 0;"><a href="${escapeAttr(msg.ctaUrl)}" style="display:inline-block;background:#178a6e;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(msg.ctaLabel ?? 'Open')}</a></p>`
    : '';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f4;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8e6;padding:28px;">
      <div style="font-size:12px;letter-spacing:2px;color:#178a6e;font-weight:700;margin-bottom:6px;">CONCRETE KING</div>
      <h2 style="margin:0 0 16px;color:#0f2e29;font-size:19px;">${escapeHtml(msg.heading)}</h2>
      ${paragraphs}
      ${cta}
      <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;">This is an automated message from your RMC plant management system.</p>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: cfg.from || cfg.user,
      to: recipients.join(', '),
      subject: msg.subject,
      text: [msg.heading, '', ...msg.lines, msg.ctaUrl ? `\n${msg.ctaLabel ?? 'Open'}: ${msg.ctaUrl}` : ''].join('\n'),
      html,
    });
    return true;
  } catch (err) {
    console.warn(`[automation] email "${msg.subject}" failed:`, err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
