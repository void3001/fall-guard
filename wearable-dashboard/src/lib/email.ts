import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface AlertEmailPayload {
  type: string;
  severity: string;
  message: string;
  device_id: string;
  worker_name?: string;
  rfid?: string;
  value?: number;
  threshold?: number;
  timestamp: number;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function severityColor(severity: string): string {
  return severity === 'CRITICAL' ? '#EF4444' : '#F59E0B';
}

export async function sendAlertEmail(alert: AlertEmailPayload): Promise<void> {
  const color = severityColor(alert.severity);
  const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafb; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: ${color}; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); color: white; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-top: 8px; }
    .body { padding: 28px; }
    .alert-message { background: #fef3c7; border-left: 4px solid ${color}; padding: 16px; border-radius: 6px; font-size: 15px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .kv { background: #f8fafb; border-radius: 8px; padding: 12px 16px; }
    .kv .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .kv .value { font-size: 18px; font-weight: 700; color: #111827; margin-top: 4px; }
    .footer { background: #f8fafb; padding: 16px 28px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    .cta { text-align: center; margin: 20px 0; }
    .cta a { background: #16a34a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Safety Alert — Industrial Wearable</h1>
      <p>${alert.message}</p>
      <span class="badge">${alert.severity}</span>
    </div>
    <div class="body">
      <div class="alert-message">${alert.message}</div>
      <div class="grid">
        <div class="kv"><div class="label">Alert Type</div><div class="value">${alert.type.replace(/_/g, ' ')}</div></div>
        <div class="kv"><div class="label">Severity</div><div class="value" style="color:${color}">${alert.severity}</div></div>
        <div class="kv"><div class="label">Device ID</div><div class="value">${alert.device_id}</div></div>
        <div class="kv"><div class="label">Worker</div><div class="value">${alert.worker_name || alert.rfid || 'Unknown'}</div></div>
        ${alert.value !== undefined ? `<div class="kv"><div class="label">Measured Value</div><div class="value">${alert.value.toFixed(2)}</div></div>` : ''}
        ${alert.threshold !== undefined ? `<div class="kv"><div class="label">Threshold</div><div class="value">${alert.threshold}</div></div>` : ''}
        <div class="kv" style="grid-column:1/-1"><div class="label">Timestamp</div><div class="value" style="font-size:14px">${formatDate(alert.timestamp)}</div></div>
      </div>
      <div class="cta">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/alerts">View on Dashboard →</a>
      </div>
    </div>
    <div class="footer">
      This is an automated alert from the Industrial Safety Wearable Dashboard.
      Sent from ${process.env.GMAIL_USER} · Do not reply to this email.
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `"Safety Wearable Alert" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `[${alert.severity}] ${alert.type.replace(/_/g, ' ')} Alert — ${alert.worker_name || alert.device_id}`,
    html,
  });
}
