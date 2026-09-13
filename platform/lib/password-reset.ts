import { randomBytes } from 'node:crypto';
import { getDb } from './db';
import { emailConfigured, sendLinkEmail } from './email';
import { RESET_EXPIRY_MINUTES } from './password';

/** Same public result for known and unknown addresses; tokens never leave the email. */
export async function deliverPasswordReset(email: string): Promise<'requested' | 'unavailable'> {
  if (!emailConfigured()) return 'unavailable';
  const db = getDb();
  const account = db.prepare('SELECT id, is_demo FROM accounts WHERE email = ? AND suspended = 0').get(email) as { id: number; is_demo: number } | undefined;
  if (!account || account.is_demo) return 'requested';
  // Limit repeat requests without invalidating a link already delivered.
  const recent = db.prepare("SELECT token FROM password_resets WHERE account_id = ? AND kind = 'reset' AND expires_at > datetime('now', ?) LIMIT 1")
    .get(account.id, `+${RESET_EXPIRY_MINUTES - 1} minutes`);
  if (recent) return 'requested';
  const token = randomBytes(32).toString('hex');
  db.prepare("INSERT INTO password_resets (token, account_id, expires_at) VALUES (?, ?, datetime('now', ?))")
    .run(token, account.id, `+${RESET_EXPIRY_MINUTES} minutes`);
  const status = await sendLinkEmail({ to: email, path: `/activate/${token}`, isDemo: false,
    subject: 'Reset your password | إعادة تعيين كلمة المرور',
    text: `Use this link to reset your password. It expires in ${RESET_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.\nاستخدموا هذا الرابط لإعادة تعيين كلمة المرور. تنتهي صلاحيته خلال ${RESET_EXPIRY_MINUTES} دقيقة. إذا لم تطلبوا ذلك، تجاهلوا هذه الرسالة.` });
  if (status !== 'sent') db.prepare('DELETE FROM password_resets WHERE token = ?').run(token);
  return 'requested';
}
