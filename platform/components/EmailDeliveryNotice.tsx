import { L } from './L';

export function EmailDeliveryNotice({ status }: { status: string | undefined }) {
  const messages: Record<string, { en: string; ar: string }> = {
    sent: { en: 'Invitation email sent.', ar: 'أُرسلت الدعوة بالبريد الإلكتروني.' },
    notConfigured: { en: 'Email is not set up yet. Share the invitation link.', ar: 'البريد الإلكتروني غير مُعدّ بعد. شاركوا رابط الدعوة.' },
    failed: { en: 'Email could not be sent. Share the invitation link or try again.', ar: 'تعذّر إرسال البريد. شاركوا رابط الدعوة أو حاولوا مجدداً.' },
    demo: { en: 'Demo invitation created. No email was sent.', ar: 'أُنشئت دعوة تجريبية. لم يُرسل بريد إلكتروني.' },
  };
  const message = status ? messages[status] : undefined;
  return message ? <p role="status" style={{ padding: 16, background: 'var(--surface2)', borderRadius: 10, fontSize: 14 }}><L en={message.en} ar={message.ar} /></p> : null;
}
