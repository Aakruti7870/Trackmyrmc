import nodemailer from 'nodemailer';

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendTestEmail(
  toEmail: string,
  toName: string,
): Promise<{ ok: boolean; error?: string }> {
  const transporter = createTransporter();

  if (!transporter) {
    return { ok: false, error: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing).' };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

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
  const transporter = createTransporter();

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping welcome email.',
    );
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
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

export async function sendPasswordResetNotification(
  toEmail: string,
  toName: string,
): Promise<boolean> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping password-reset notification email.',
    );
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

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
