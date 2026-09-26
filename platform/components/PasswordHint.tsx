import { AUTH_POLICY } from '../lib/rules';
import { L } from './L';

export function PasswordHint() {
  const policy = AUTH_POLICY.password;
  const en = [`Use at least ${policy.minLength} characters.`];
  const ar = [`استخدموا ${policy.minLength} أحرف على الأقل.`];
  if (policy.requireUppercase) { en.push('Include a capital letter (A–Z).'); ar.push('أضيفوا حرفاً لاتينياً كبيراً (A–Z).'); }
  if (policy.requireDigit) { en.push('Include a number.'); ar.push('أضيفوا رقماً.'); }
  if (policy.requireSymbol) { en.push('Include a symbol, such as ! or #.'); ar.push('أضيفوا رمزاً مثل ! أو #.'); }
  return <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}><L en={en.join(' ')} ar={ar.join(' ')} /></span>;
}
