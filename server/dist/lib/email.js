import nodemailer from 'nodemailer';
import { getSettings } from './settings.js';
export const SMTP_KEYS = {
    host: 'smtp_host',
    port: 'smtp_port',
    user: 'smtp_user',
    pass: 'smtp_pass',
    from: 'smtp_from',
};
function clean(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
function maskValue(value) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const atIndex = trimmed.indexOf('@');
    if (atIndex > 0) {
        const local = trimmed.slice(0, atIndex);
        const domain = trimmed.slice(atIndex);
        const visible = local.slice(0, Math.min(2, local.length));
        return `${visible}${'•'.repeat(Math.max(3, local.length - visible.length))}${domain}`;
    }
    if (trimmed.length <= 2)
        return '•'.repeat(trimmed.length);
    const head = trimmed.slice(0, 2);
    const tail = trimmed.slice(-1);
    return `${head}${'•'.repeat(Math.max(3, trimmed.length - 3))}${tail}`;
}
// Resolve the effective SMTP configuration: persisted database settings take
// precedence, falling back per-field to the matching environment variable.
export async function getSmtpConfig() {
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
function transporterFor(cfg) {
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
export async function sendTestEmail(toEmail, toName) {
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
            subject: 'SMTP Test — Aakruti Infra RMC Plant',
            text: [
                `Hello ${toName},`,
                '',
                'This is a test email sent from the Aakruti Infra RMC Plant Management System to verify that your SMTP settings are working correctly.',
                '',
                'If you received this message, your email configuration is working.',
                '',
                '— Aakruti Infra RMC Plant Management System',
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
              Aakruti Infra RMC Plant
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
              <strong>Aakruti Infra RMC Plant Management System</strong>
              to verify that your SMTP settings are configured correctly.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 24px">
              <p style="color:#15803d;font-weight:700;margin:0;font-size:15px">
                ✓ Your email configuration is working correctly.
              </p>
            </div>
            <hr style="border:none;border-top:1px solid #eee;margin:0 0 24px">
            <p style="color:#888;font-size:13px;margin:0">
              — Aakruti Infra RMC Plant Management System
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}
export async function sendWelcomeEmail(toEmail, toName, role) {
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping welcome email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Welcome to Aakruti Infra RMC Plant',
        text: [
            `Hello ${toName},`,
            '',
            'Your account has been created on the Aakruti Infra RMC Plant Management System.',
            '',
            `  Name:  ${toName}`,
            `  Email: ${toEmail}`,
            `  Role:  ${roleLabel}`,
            '',
            'Please log in and change your password at your earliest convenience.',
            '',
            'Do not share your password with anyone.',
            '',
            '— Aakruti Infra RMC Plant Management System',
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
              Aakruti Infra RMC Plant
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
              <strong>Aakruti Infra RMC Plant Management System</strong>.
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
              — Aakruti Infra RMC Plant Management System
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
export async function sendPasswordResetNotification(toEmail, toName) {
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping password-reset notification email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Your password has been reset — Aakruti Infra RMC',
        text: [
            `Hello ${toName},`,
            '',
            'This is a security notice to let you know that an administrator has reset your password on the Aakruti Infra RMC Plant Management System.',
            '',
            'If you requested this change, you can log in with your new password.',
            '',
            'If you did NOT request this change, please contact your system administrator immediately.',
            '',
            '— Aakruti Infra RMC Plant Management System',
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
              Aakruti Infra RMC Plant
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
              Aakruti Infra RMC Plant Management System.
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
              — Aakruti Infra RMC Plant Management System
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
