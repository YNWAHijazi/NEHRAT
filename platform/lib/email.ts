import nodemailer from 'nodemailer';
import { createHash } from 'node:crypto';
import { getDb } from './db';

export type MailResult = 'sent' | 'notConfigured' | 'failed' | 'demo';

export function emailConfigured(): boolean {
  const has = (key: string) => Boolean(process.env[key]?.trim());
  return has('MAIL_FROM') && has('APP_BASE_URL') && (has('RESEND_API_KEY') || ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'].every(has));
}

/** No invitation tokens, passwords or message bodies are written to the delivery log. */
export async function sendLinkEmail(input: { to: string; path: string; subject: string; text: string; isDemo: boolean }): Promise<MailResult> {
  let status: MailResult = input.isDemo ? 'demo' : 'notConfigured';
  if (!input.isDemo && emailConfigured()) {
    try {
      const base = new URL(process.env.APP_BASE_URL!);
      if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Invalid public URL');
      const url = new URL(input.path, base.origin);
      if (url.origin !== base.origin) throw new Error('Invalid link');
      const subject = input.subject.replace(/[\r\n]/g, ' ');
      const text = `${input.text}\n\n${url.href}`;
      if (process.env.RESEND_API_KEY?.trim()) {
        // HTTPS works on every Railway plan; SMTP is restricted on some plans.
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': createHash('sha256').update(JSON.stringify([input.to, subject, text])).digest('hex'),
          },
          body: JSON.stringify({ from: process.env.MAIL_FROM!.trim(), to: [input.to], subject, text }),
          signal: AbortSignal.timeout(15000),
        });
        const result: unknown = response.ok ? await response.json() : null;
        status = result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' && result.id.length > 0 ? 'sent' : 'failed';
      } else {
        const port = Number(process.env.SMTP_PORT ?? 587);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST, port, secure: port === 465, requireTLS: true,
          auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
          tls: { rejectUnauthorized: true }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000,
          disableFileAccess: true, disableUrlAccess: true,
        });
        const result = await transport.sendMail({
          from: process.env.MAIL_FROM!, to: { name: '', address: input.to },
          subject, text,
        });
        status = result.accepted.length > 0 ? 'sent' : 'failed';
      }
    } catch { status = 'failed'; }
  }
  getDb().prepare('INSERT INTO email_deliveries (recipient, status, is_demo) VALUES (?, ?, ?)').run(input.to, status, input.isDemo ? 1 : 0);
  return status;
}
