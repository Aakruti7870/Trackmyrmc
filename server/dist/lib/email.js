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
// Verify that the given SMTP values can actually connect/authenticate, without
// persisting anything. Each override is merged over the effective config so a
// blank field (e.g. an unchanged password) falls back to the stored value.
export async function verifySmtpConnection(overrides = {}) {
    const base = await getSmtpConfig();
    const cfg = {
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
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
// Invite a newly-provisioned account holder (e.g. a plant owner) to set their
// OWN password via a single-use, time-limited link, instead of staff typing and
// sharing a temporary password. Best-effort like the other notifications:
// returns false (and logs) when SMTP is unconfigured rather than throwing.
export async function sendOwnerInviteEmail(toEmail, toName, role, inviteUrl, expiresAt) {
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping owner invite email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const expires = expiresAt.toUTCString();
    await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Set up your Aakruti Infra RMC Plant login',
        text: [
            `Hello ${toName},`,
            '',
            'An account has been created for you on the Aakruti Infra RMC Plant Management System.',
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
              Set Up Your Login
            </h2>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              Hello <strong>${toName}</strong>,
            </p>
            <p style="color:#444;line-height:1.6;margin:0 0 16px">
              An account has been created for you on the
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
// Notify a customer that one of their concrete deliveries has been dispatched
// from the plant or has arrived/been delivered. Best-effort: returns false (and
// logs) when SMTP is unconfigured rather than throwing, so callers in the
// request path never fail because email is unavailable.
export async function sendDeliveryNotificationEmail(toEmail, toName, details) {
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping delivery notification email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    const dispatched = details.status === 'dispatched';
    const heading = dispatched ? 'Your Concrete Is On The Way' : 'Your Concrete Has Been Delivered';
    const subject = dispatched
        ? `Dispatched: Challan ${details.challanNo} — Aakruti Infra RMC`
        : `Delivered: Challan ${details.challanNo} — Aakruti Infra RMC`;
    const lead = dispatched
        ? 'A transit mixer carrying your order has just been dispatched from our plant and is on its way to your site.'
        : 'Your concrete order has been delivered. Thank you for choosing Aakruti Infra RMC.';
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
export async function sendPlantInviteNotification(toEmails, details) {
    const recipients = toEmails.map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0)
        return false;
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping new plant-request notification email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    const { plantName, address, contactNumber, requestedByName } = details;
    const safe = (v) => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
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
const WHATSAPP_EVENT_LABEL = {
    order: 'order confirmation',
    dispatch: 'dispatch update',
    delivery: 'delivery update',
};
export async function sendWhatsAppFailureAlertEmail(toEmails, details) {
    const recipients = toEmails.map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0)
        return false;
    const cfg = await getSmtpConfig();
    const transporter = transporterFor(cfg);
    if (!transporter) {
        console.warn('[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
            'Skipping WhatsApp delivery-failure alert email.');
        return false;
    }
    const from = cfg.from || cfg.user || undefined;
    const safe = (v) => String(v ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
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
