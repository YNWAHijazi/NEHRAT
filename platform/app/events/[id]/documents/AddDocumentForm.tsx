'use client';

/**
 * Adding a document to the shared list. The review build records the document's
 * name and file name; storage of the binary follows the same later decision as the
 * organizer's attachments.
 */

import { useState } from 'react';
import { L } from '../../../../components/L';
import { addSharedDocumentAction } from '../../../actions';

export function AddDocumentForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBlockEnd: 24 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
        >
          <L en="Add a document" ar="إضافة مستند" />
        </button>
      </div>
    );
  }
  return (
    <form action={addSharedDocumentAction.bind(null, token)} style={{ padding: '22px 26px', border: '1px solid var(--line)', borderRadius: 12, marginBlockEnd: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, alignItems: 'end' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en="Document name" ar="اسم المستند" />
        </span>
        <input name="name" required style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15 }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
          <L en="File name" ar="اسم الملف" />
        </span>
        <input name="fileName" style={{ height: 44, paddingInline: 14, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 15 }} />
      </label>
      <button type="submit" style={{ height: 44, paddingInline: 22, border: 0, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500, cursor: 'pointer' }}>
        <L en="Add" ar="إضافة" />
      </button>
    </form>
  );
}
