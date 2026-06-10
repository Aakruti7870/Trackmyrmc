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

export async function sendPasswordResetNotification(
  toEmail: string,
  toName: string,
): Promise<void> {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn(
      '[email] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing). ' +
      'Skipping password-reset notification email.',
    );
    return;
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
}
