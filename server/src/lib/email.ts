import nodemailer from 'nodemailer';
import { getSettings } from './settings.js';

export const SMTP_KEYS = {
  host: 'smtp_host',
  port: 'smtp_port',
  user: 'smtp_user',
  pass: 'smtp_pass',
  from: 'smtp_from',
} as const;

export interface ResolvedSmtp {
  host: string | null;
  port: string | null;
  user: string | null;
  pass: string | null;
  from: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function maskValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const atIndex = trimmed.indexOf('@');
  if (atIndex > 0) {
    const local = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex);
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
  }

  if (trimmed.length <= 2) return '•'.repeat(trimmed.length);
  const head = trimmed.slice(0, 2);
  const tail = trimmed.slice(-1);
  return `${head}${'•'.repeat(Math.max(3, trimmed.length - 3))}${tail}`;
}

// Resolve the effective SMTP configuration: persisted database settings take
// precedence, falling back per-field to the matching environment variable.
export async function getSmtpConfig(): Promise<ResolvedSmtp> {
  const persisted = await getSettings(Object.values(SMTP_KEYS));
  return {
    host: clean(persisted[SMTP_KEYS.host]) ?? clean(process.env.SMTP_HOST),
    port: clean(persisted[SMTP_KEYS.port]) ?? clean(process.env.SMTP_PORT),
    user: clean(persisted[SMTP_KEYS.user]) ?? clean(process.env.SMTP_USER),
    pass: clean(persisted[SMTP_KEYS.pass]) ?? clean(process.env.SMTP_PASS),
    from: clean(persisted[SMTP_KEYS.from]) ?? clean(process.env.SMTP_FROM),
  };
}

export async function getSmtpSettings() {
  const cfg = await getSmtpConfig();
  return {
    host: cfg.host,
    port: cfg.port || (cfg.host ? '587' : null),
    user: maskValue(cfg.user),
    from: maskValue(cfg.from || cfg.user),
    configured: Boolean(cfg.host && cfg.user && cfg.pass),
  };
}

function transporterFor(cfg: ResolvedSmtp) {
  const port = parseInt(cfg.port || '587', 10);

  if (!cfg.host || !cfg.user || !cfg.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: cfg.host,
    port,
    secure: port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

async function createTransporter() {
  const cfg = await getSmtpConfig();
  return transporterFor(cfg);
}

// Verify that the given SMTP values can actually connect/authenticate, without
// persisting anything. Each override is merged over the effective config so a
// blank field (e.g. an unchanged password) falls back to the stored value.
export async function verifySmtpConnection(
  overrides: Partial<ResolvedSmtp> = {},
): Promise<{ ok: boolean; error?: string }> {
  const base = await getSmtpConfig();
  const cfg: ResolvedSmtp = {
    host: clean(overrides.host) ?? base.host,
    port: clean(overrides.port) ?? base.port,
    user: clean(overrides.user) ?? base.user,
    pass: clean(overrides.pass) ?? base.pass,
    from: clean(overrides.from) ?? base.from,
  };

  const transporter = transporterFor(cfg);
  if (!transporter) {
    return {
      ok: false,
      error: 'SMTP is incomplete — host, username and password are all required to test the connection.',
    };
  }

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function sendTestEmail(
  toEmail: string,
  toName: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    return { ok: false, error: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing).' };
  }

  const from = cfg.from || cfg.user || undefined;

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'SMTP Test — CONCRETE KING RMC Plant',
      text: [
        `Hello ${toName},`,
        '',
        'This is a test email sent from the CONCRETE KING RMC Plant Management System to verify that your SMTP settings are working correctly.',
        '',
        'If you received this message, your email configuration is working.',
        '',
        '— CONCRETE KING RMC Plant Management System',
      ].join('\n'),
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              SMTP Configuration Test
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              This is a test email sent from the
              <strong>CONCRETE KING RMC Plant Management System</strong>
              to verify that your SMTP settings are configured correctly.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 24px">
              <p style="color:#15803d;font-weight:700;margin:0;font-size:15px">
                ✓ Your email configuration is working correctly.
              </p>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function sendWelcomeEmail(
  toEmail: string,
  toName: string,
  role: string,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping welcome email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Welcome to CONCRETE KING RMC Plant',
    text: [
      `Hello ${toName},`,
      '',
      'Your account has been created on the CONCRETE KING RMC Plant Management System.',
      '',
      `  Name:  ${toName}`,
      `  Email: ${toEmail}`,
      `  Role:  ${roleLabel}`,
      '',
      'Please log in and change your password at your earliest convenience.',
      '',
      'Do not share your password with anyone.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Welcome to the System
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Your account has been created on the
              <strong>CONCRETE KING RMC Plant Management System</strong>.
              Here are your account details:
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                          padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:80px">Name</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${toName}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Email</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${toEmail}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Role</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${roleLabel}</td>
              </tr>
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              Please log in and <strong>change your password</strong> at your earliest convenience.
              Do not share your password with anyone.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

// Invite a newly-provisioned account holder (e.g. a plant owner) to set their
// OWN password via a single-use, time-limited link, instead of staff typing and
// sharing a temporary password. Best-effort like the other notifications:
// returns false (and logs) when SMTP is unconfigured rather than throwing.
export async function sendOwnerInviteEmail(
  toEmail: string,
  toName: string,
  role: string,
  inviteUrl: string,
  expiresAt: Date,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping owner invite email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const expires = expiresAt.toUTCString();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Set up your CONCRETE KING RMC Plant login',
    text: [
      `Hello ${toName},`,
      '',
      'An account has been created for you on the CONCRETE KING RMC Plant Management System.',
      '',
      `  Name:  ${toName}`,
      `  Email: ${toEmail}`,
      `  Role:  ${roleLabel}`,
      '',
      'To finish setting up your account, choose your own password using the secure link below:',
      '',
      `  ${inviteUrl}`,
      '',
      `This link can be used once and expires on ${expires}.`,
      'If you did not expect this email, you can safely ignore it.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Set Up Your Login
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              An account has been created for you on the
              <strong>CONCRETE KING RMC Plant Management System</strong>.
              Here are your account details:
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                          padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:80px">Name</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${toName}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Email</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${toEmail}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Role</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${roleLabel}</td>
              </tr>
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 20px">
              To finish setting up your account, choose your own password:
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="border-radius:8px;background:#f7c948">
                  <a href="${inviteUrl}"
                     style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;
                            color:#1a1a1a;text-decoration:none;border-radius:8px">
                    Set your password
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#666;line-height:1.6;margin:0 0 8px;font-size:13px">
              Or paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;font-size:13px;word-break:break-all">
              <a href="${inviteUrl}" style="color:#2563eb">${inviteUrl}</a>
            </p>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px">
              <p style="color:#92400e;margin:0;font-size:13px;line-height:1.5">
                This link can be used <strong>once</strong> and expires on <strong>${expires}</strong>.
                If you did not expect this email, you can safely ignore it.
              </p>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

// Send a password-reset link to a user who asked to reset their own password.
// Mirrors the owner-invite email's best-effort contract: returns false (and
// logs) when SMTP is unconfigured rather than throwing, so the request path
// never fails because email is unavailable.
export async function sendPasswordResetEmail(
  toEmail: string,
  toName: string,
  resetUrl: string,
  expiresAt: Date,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping password-reset email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const expires = expiresAt.toUTCString();

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Reset your CONCRETE KING RMC Plant password',
    text: [
      `Hello ${toName},`,
      '',
      'We received a request to reset the password for your CONCRETE KING RMC Plant Management System account.',
      '',
      'Choose a new password using the secure link below:',
      '',
      `  ${resetUrl}`,
      '',
      `This link can be used once and expires on ${expires}.`,
      'If you did not request a password reset, you can safely ignore this email — your password will stay unchanged.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Reset Your Password
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 20px">
              We received a request to reset the password for your
              <strong>CONCRETE KING RMC Plant Management System</strong> account.
              Choose a new password below:
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
              <tr>
                <td style="border-radius:8px;background:#f7c948">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;
                            color:#1a1a1a;text-decoration:none;border-radius:8px">
                    Reset your password
                  </a>
                </td>
              </tr>
            </table>
            <p style="color:#666;line-height:1.6;margin:0 0 8px;font-size:13px">
              Or paste this link into your browser:
            </p>
            <p style="margin:0 0 24px;font-size:13px;word-break:break-all">
              <a href="${resetUrl}" style="color:#2563eb">${resetUrl}</a>
            </p>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px">
              <p style="color:#92400e;margin:0;font-size:13px;line-height:1.5">
                This link can be used <strong>once</strong> and expires on <strong>${expires}</strong>.
                If you did not request a password reset, you can safely ignore this email —
                your password will stay unchanged.
              </p>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

// Send a one-time login code to a staff/owner (or the Super Admin's 2FA step).
// Best-effort like the other notifications: returns false (and logs) when SMTP
// is unconfigured rather than throwing, so the caller can fall back to another
// channel. The plaintext code is only ever placed in the email body itself.
export async function sendLoginCodeEmail(
  toEmail: string,
  toName: string,
  code: string,
  expiresMinutes: number,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping login-code email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const spaced = code.split('').join(' ');

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: `${code} is your CONCRETE KING login code`,
    text: [
      `Hello ${toName},`,
      '',
      'Use this one-time code to sign in to CONCRETE KING:',
      '',
      `  ${code}`,
      '',
      `This code expires in ${expiresMinutes} minutes and can be used once.`,
      'If you did not try to sign in, you can safely ignore this email — your account stays secure.',
      '',
      '— CONCRETE KING',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#0a221e;padding:24px 32px">
            <h1 style="margin:0;color:#1f9e80;font-size:20px;font-weight:700">
              CONCRETE KING
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Your Login Code
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 20px">
              Hello <strong>${toName}</strong>, use this one-time code to sign in:
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
              <span style="color:#0f2e29;font-size:34px;font-weight:800;letter-spacing:8px">${spaced}</span>
            </div>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              This code expires in <strong>${expiresMinutes} minutes</strong> and can be used once.
              If you did not try to sign in, you can safely ignore this email.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">— CONCRETE KING</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

export interface DeliveryNotificationDetails {
  challanNo: string;
  grade: string;
  quantity: string;
  siteName: string | null;
  status: 'dispatched' | 'delivered';
}

// Notify a customer that one of their concrete deliveries has been dispatched
// from the plant or has arrived/been delivered. Best-effort: returns false (and
// logs) when SMTP is unconfigured rather than throwing, so callers in the
// request path never fail because email is unavailable.
export async function sendDeliveryNotificationEmail(
  toEmail: string,
  toName: string,
  details: DeliveryNotificationDetails,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping delivery notification email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const dispatched = details.status === 'dispatched';
  const heading = dispatched ? 'Your Concrete Is On The Way' : 'Your Concrete Has Been Delivered';
  const subject = dispatched
    ? `Dispatched: Challan ${details.challanNo} — CONCRETE KING RMC`
    : `Delivered: Challan ${details.challanNo} — CONCRETE KING RMC`;
  const lead = dispatched
    ? 'A transit mixer carrying your order has just been dispatched from our plant and is on its way to your site.'
    : 'Your concrete order has been delivered. Thank you for choosing CONCRETE KING RMC.';
  const accent = dispatched ? '#2563eb' : '#15803d';
  const banner = dispatched ? '#eff6ff' : '#f0fdf4';
  const bannerBorder = dispatched ? '#bfdbfe' : '#bbf7d0';
  const siteLine = details.siteName ? `  Site:    ${details.siteName}\n` : '';

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text: [
      `Hello ${toName},`,
      '',
      lead,
      '',
      `  Challan: ${details.challanNo}`,
      `  Grade:   ${details.grade}`,
      `  Qty:     ${details.quantity} m³`,
      siteLine,
      'You can track this delivery from your customer portal.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              ${heading}
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              ${lead}
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:${banner};border:1px solid ${bannerBorder};border-radius:8px;
                          padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:90px">Challan</td>
                <td style="color:${accent};font-size:14px;font-weight:700;padding:4px 0">${details.challanNo}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Grade</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.grade}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Quantity</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.quantity} m³</td>
              </tr>
              ${details.siteName ? `<tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Site</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.siteName}</td>
              </tr>` : ''}
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              You can track this delivery anytime from your customer portal.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

export interface OrderPlacedDetails {
  orderNo: string;
  grade: string;
  quantity: string;
  deliveryDate: string | null;
  plantName: string | null;
}

// Confirm to a customer that their concrete order has been received. Mirrors the
// delivery-notification email's best-effort contract: returns false (and logs)
// when SMTP is unconfigured rather than throwing.
export async function sendOrderPlacedEmail(
  toEmail: string,
  toName: string,
  details: OrderPlacedDetails,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping order-placed email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const plant = details.plantName || 'the plant';
  const subject = `Order Received: ${details.orderNo} — CONCRETE KING RMC`;
  const lead =
    `We've received your concrete order and ${plant} is preparing it for dispatch. ` +
    `You'll get another notification the moment a transit mixer is on its way.`;
  const accent = '#b45309';
  const banner = '#fffbeb';
  const bannerBorder = '#fde68a';

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text: [
      `Hello ${toName},`,
      '',
      lead,
      '',
      `  Order:    ${details.orderNo}`,
      `  Grade:    ${details.grade}`,
      `  Qty:      ${details.quantity} m³`,
      `  Delivery: ${details.deliveryDate || 'to be scheduled'}`,
      `  Plant:    ${plant}`,
      '',
      'You can track this order anytime from your customer portal.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Your Order Has Been Received
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              ${lead}
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:${banner};border:1px solid ${bannerBorder};border-radius:8px;
                          padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:90px">Order</td>
                <td style="color:${accent};font-size:14px;font-weight:700;padding:4px 0">${details.orderNo}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Grade</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.grade}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Quantity</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.quantity} m³</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Delivery</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.deliveryDate || 'to be scheduled'}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Plant</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${plant}</td>
              </tr>
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              You can track this order anytime from your customer portal.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

export interface BatchLoggedDetails {
  batchNo: string;
  grade: string;
  quantity: string;
  operator?: string | null;
  plantName?: string | null;
}

// Internal staff alert when a production batch is logged. Sent to plant staff
// (admins/owners/supervisors/dispatchers), not customers. Best-effort: returns
// false (and logs) when SMTP is unconfigured or there are no recipients.
export async function sendBatchLoggedEmail(
  toEmails: string[],
  details: BatchLoggedDetails,
): Promise<boolean> {
  if (toEmails.length === 0) return false;
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);
  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping batch-logged email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const plant = details.plantName || 'the plant';
  const subject = `Batch Logged: ${details.batchNo} — ${details.grade}`;
  const lead = `A new concrete batch has been logged at ${plant}.`;

  await transporter.sendMail({
    from,
    to: toEmails,
    subject,
    text: [
      lead,
      '',
      `  Batch:    ${details.batchNo}`,
      `  Grade:    ${details.grade}`,
      `  Qty:      ${details.quantity} m³`,
      `  Operator: ${details.operator || '—'}`,
      `  Plant:    ${plant}`,
      '',
      '— Concrete King RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">Concrete King RMC Plant</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">New Batch Logged</h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">${lead}</p>
            <table cellpadding="0" cellspacing="0"
                   style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
                          padding:16px 20px;margin:0 0 24px;width:100%">
              <tr><td style="color:#555;font-size:14px;padding:4px 0;width:90px">Batch</td>
                  <td style="color:#b45309;font-size:14px;font-weight:700;padding:4px 0">${details.batchNo}</td></tr>
              <tr><td style="color:#555;font-size:14px;padding:4px 0">Grade</td>
                  <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.grade}</td></tr>
              <tr><td style="color:#555;font-size:14px;padding:4px 0">Quantity</td>
                  <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.quantity} m³</td></tr>
              <tr><td style="color:#555;font-size:14px;padding:4px 0">Operator</td>
                  <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${details.operator || '—'}</td></tr>
              <tr><td style="color:#555;font-size:14px;padding:4px 0">Plant</td>
                  <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${plant}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">— Concrete King RMC Plant Management System</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

export async function sendPasswordResetNotification(
  toEmail: string,
  toName: string,
): Promise<boolean> {
  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping password-reset notification email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Your password has been reset — CONCRETE KING RMC',
    text: [
      `Hello ${toName},`,
      '',
      'This is a security notice to let you know that an administrator has reset your password on the CONCRETE KING RMC Plant Management System.',
      '',
      'If you requested this change, you can log in with your new password.',
      '',
      'If you did NOT request this change, please contact your system administrator immediately.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              Password Reset Notice
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              This is a security notice to let you know that an administrator has
              <strong>reset your password</strong> on the
              CONCRETE KING RMC Plant Management System.
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              If you requested this change, you can log in with your new password.
            </p>
            <p style="color:#c0392b;line-height:1.6;margin:0 0 24px">
              If you did <strong>NOT</strong> request this change, please contact your
              system administrator immediately.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

// Alert admins that a customer has flagged a discovered plant for onboarding.
// Sent to every active admin/authority mailbox (joined into a single message)
// when a NEW lead is created — repeat/de-duplicated requests are skipped by the
// caller so this never spams. Best-effort like the other notifications: returns
// false (and logs) when SMTP is unconfigured rather than throwing.
export interface PlantInviteNotificationDetails {
  plantName: string;
  address?: string | null;
  contactNumber?: string | null;
  requestedByName?: string | null;
}

export async function sendPlantInviteNotification(
  toEmails: string[],
  details: PlantInviteNotificationDetails,
): Promise<boolean> {
  const recipients = toEmails.map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) return false;

  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping new plant-request notification email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const { plantName, address, contactNumber, requestedByName } = details;
  const safe = (v: string | null | undefined) =>
    String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

  await transporter.sendMail({
    from,
    to: recipients,
    subject: `New plant onboarding request: ${plantName}`,
    text: [
      'A customer has requested that a new plant be onboarded to the marketplace.',
      '',
      `  Plant:     ${plantName}`,
      ...(address ? [`  Address:   ${address}`] : []),
      ...(contactNumber ? [`  Contact:   ${contactNumber}`] : []),
      ...(requestedByName ? [`  Requested by: ${requestedByName}`] : []),
      '',
      'Open the Plants page -> "Onboarding requests" tab to review and onboard it.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#1a1a1a;font-size:18px">
              New Plant Onboarding Request
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              A customer has requested that a new plant be onboarded to the marketplace.
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:110px">Plant</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(plantName)}</td>
              </tr>
              ${address ? `<tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Address</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(address)}</td>
              </tr>` : ''}
              ${contactNumber ? `<tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Contact</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(contactNumber)}</td>
              </tr>` : ''}
              ${requestedByName ? `<tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Requested by</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(requestedByName)}</td>
              </tr>` : ''}
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              Open the <strong>Plants</strong> page -> <strong>Onboarding requests</strong> tab to review and onboard it.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

// Alert staff that a customer's WhatsApp order/dispatch/delivery update could not
// be delivered (e.g. invalid number, no WhatsApp account, opted-out). Sent to the
// active staff mailboxes (joined into one message) so they can phone the customer
// instead. Best-effort like the other notifications: returns false (and logs)
// when SMTP is unconfigured rather than throwing.
export interface WhatsAppFailureAlertDetails {
  event: 'order' | 'dispatch' | 'delivery';
  toPhone: string;
  status: string;
  errorCode?: string | null;
  orderNo?: string | null;
  challanNo?: string | null;
}

const WHATSAPP_EVENT_LABEL: Record<string, string> = {
  order: 'order confirmation',
  dispatch: 'dispatch update',
  delivery: 'delivery update',
};

export async function sendWhatsAppFailureAlertEmail(
  toEmails: string[],
  details: WhatsAppFailureAlertDetails,
): Promise<boolean> {
  const recipients = toEmails.map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) return false;

  const cfg = await getSmtpConfig();
  const transporter = transporterFor(cfg);

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping WhatsApp delivery-failure alert email.',
    );
    return false;
  }

  const from = cfg.from || cfg.user || undefined;
  const safe = (v: string | null | undefined) =>
    String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const kind = WHATSAPP_EVENT_LABEL[details.event] ?? `${details.event} update`;
  const ref = details.challanNo
    ? `Challan ${details.challanNo}`
    : details.orderNo
      ? `Order ${details.orderNo}`
      : 'a record';
  const errorSuffix = details.errorCode ? ` (error ${details.errorCode})` : '';

  await transporter.sendMail({
    from,
    to: recipients,
    subject: `WhatsApp ${kind} failed: ${ref}`,
    text: [
      `A customer's WhatsApp ${kind} could not be delivered${errorSuffix}.`,
      'The customer never received this update — please call them instead.',
      '',
      `  Reference:   ${ref}`,
      `  Customer:    ${details.toPhone}`,
      `  Update type: ${kind}`,
      `  Status:      ${details.status}`,
      ...(details.errorCode ? [`  Twilio error: ${details.errorCode}`] : []),
      '',
      'Open Profile & Settings -> "WhatsApp Delivery Status" to review.',
      '',
      '— CONCRETE KING RMC Plant Management System',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:#08111f;padding:24px 32px">
            <h1 style="margin:0;color:#f7c948;font-size:20px;font-weight:700">
              CONCRETE KING RMC Plant
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h2 style="margin:0 0 16px;color:#b91c1c;font-size:18px">
              WhatsApp Update Failed
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              A customer's WhatsApp ${safe(kind)} could not be delivered. The
              customer never received this update — please call them instead.
            </p>
            <table cellpadding="0" cellspacing="0"
                   style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:0 0 24px;width:100%">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;width:120px">Reference</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(ref)}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Customer</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(details.toPhone)}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Update type</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(kind)}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Status</td>
                <td style="color:#b91c1c;font-size:14px;font-weight:700;padding:4px 0">${safe(details.status)}</td>
              </tr>
              ${details.errorCode ? `<tr>
                <td style="color:#555;font-size:14px;padding:4px 0">Twilio error</td>
                <td style="color:#1a1a1a;font-size:14px;font-weight:600;padding:4px 0">${safe(details.errorCode)}</td>
              </tr>` : ''}
            </table>
            <p style="color:#444;line-height:1.6;margin:0 0 24px">
              Open <strong>Profile &amp; Settings</strong> -> <strong>WhatsApp Delivery Status</strong> to review.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — CONCRETE KING RMC Plant Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
  return true;
}

