'use client';

/**
 * Returning the report: the figures are the organizer's to correct. The reason
 * travels to the organizer as written.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { returnPostEventReportAction } from '../../../actions';

export function ReturnReportBlock({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ height: 44, paddingInline: 20, border: '1px solid var(--line)', background: 'none', borderRadius: 22, fontSize: '14.5px', cursor: 'pointer' }}
      >
        <L en="Return the report to the organizer" ar="إعادة التقرير إلى المنظّم" />
      </button>
    );
  }
  return (
    <form action={returnPostEventReportAction.bind(null, eventId)} style={{ flexBasis: '100%', padding: '20px 24px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', borderRadius: 12 }}>
      <div style={{ fontSize: '13.5px', color: 'var(--muted)', marginBlockEnd: 6 }}>
        <L en="What is wrong, as the organizer should read it." ar="ما الخطأ، كما ينبغي أن يقرأه المنظّم." />
      </div>
      <textarea name="reason" rows={3} required style={{ width: '100%', padding: 12, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15, lineHeight: 1.6, resize: 'vertical', marginBlockEnd: 12 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" style={{ height: 42, paddingInline: 20, border: 0, borderRadius: 21, background: 'var(--accent-ink)', color: 'var(--bg)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          <L en="Return with this reason" ar="الإعادة مع هذا السبب" />
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ height: 42, paddingInline: 18, border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 21, fontSize: 14, cursor: 'pointer' }}>
          <L en="Go back" ar="العودة" />
        </button>
      </div>
    </form>
  );
}
