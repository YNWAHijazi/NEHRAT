import Link from 'next/link';
import { L } from './L';
import type { Gate } from '../lib/rules';
import enMessages from '../lib/i18n/messages/en.json';
import arMessages from '../lib/i18n/messages/ar.json';

export function messageFor(catalog: Record<string, unknown>, key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let node: unknown = catalog;
  for (const part of parts) {
    node = (node as Record<string, unknown>)[part];
  }
  let text = String(node ?? key);
  for (const [k, v] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

/** A gate's reason in both languages, from the message catalogues. */
export function gateReason(gate: Gate): { en: string; ar: string } {
  return {
    en: gate.reasonKey ? messageFor(enMessages, gate.reasonKey, gate.params) : '',
    ar: gate.reasonKey ? messageFor(arMessages, gate.reasonKey, gate.params) : '',
  };
}

/**
 * The four routes off the event record.
 *
 * They were a wrapping flex row, which put three pills on one line at three
 * different widths and the fourth alone on the next, with two reason captions
 * hanging under two of them and nothing lining up with anything. A grid gives
 * one column per action: the pills come out the same width, they sit on a
 * shared baseline, and every caption starts on the same line.
 *
 * ONE pill style, used by the plain link and by BOTH branches of GatedAction.
 * It was three inline copies and they had already drifted -- the disabled
 * button carried neither the colour nor the centring the two links had.
 */
export const actionGrid: React.CSSProperties = {
  display: 'grid',
  /**
   * 376px is measured, not chosen: the longest label, "Open requirements and
   * attachments", sets 331px of text and the pill adds 44px of padding. Below
   * that the label wraps to two lines and the row stops looking aligned, which
   * is what a narrower column produced on the first attempt.
   */
  /**
   * min(376px, 100%), not 376px: a bare minimum track is a FLOOR the grid will
   * not go below, so on a 335px phone the row overflowed its own panel by 41px
   * and the page scrolled sideways. Wrapping it in min() lets the track collapse
   * to the container when the container is the smaller of the two.
   */
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(376px, 100%), 1fr))',
  gap: '14px 12px',
  alignItems: 'start',
  /**
   * Its own full-width row under the counters. Sharing the row left 731px, which
   * fits one 376px column and wastes the rest; the full width fits two.
   */
  flexBasis: '100%',
  // Basis alone left the row at its content width inside a wider panel; grow
  // makes it actually take the row it was given.
  flexGrow: 1,
};

export const actionCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  alignItems: 'stretch',
};

export const actionPill: React.CSSProperties = {
  // A FLOOR, not a fixed height: the Arabic issue of a label is not the English
  // one's length, and a fixed height clips the second line rather than growing.
  // Tightened (partner ruling, 2026-09-05): these three rows are waiting states,
  // not the page's subject, and they were taking a phone screen between them.
  minHeight: 34,
  paddingBlock: 6,
  paddingInline: 16,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  borderRadius: 17,
  fontSize: '13.5px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink)',
  width: '100%',
};

/**
 * Disabled is NOT the same pill in a grid cell. Non-negotiable 10 turns on a
 * reader telling "will become available" from "live" at a glance, and the old
 * disabled button got that distinction from the browser's default disabled
 * grey -- which the shared style would have overwritten with --ink, leaving a
 * dead control that looks live. Muted is stated here rather than inherited.
 */
export const actionPillDisabled: React.CSSProperties = { ...actionPill, color: 'var(--muted)' };

export const actionReason: React.CSSProperties = {
  fontSize: '11.5px',
  lineHeight: 1.4,
  color: 'var(--muted)',
};

/**
 * A gated action row. Two behaviours, distinguishable at a glance:
 * enabled renders as a live control; disabled renders greyed WITH its reason beside it.
 * The third behaviour, absent, never reaches this component -- absent means no row.
 */
export function GatedAction({
  gate,
  href,
  en,
  ar,
}: {
  gate: Gate;
  href: string;
  en: string;
  ar: string;
}) {
  if (gate.behaviour === 'absent') return null;
  if (gate.behaviour === 'enabled') {
    return (
      <span style={actionCell}>
        <Link href={href} style={actionPill}>
          <L en={en} ar={ar} />
        </Link>
      </span>
    );
  }
  const reason = gateReason(gate);
  return (
    <span style={actionCell}>
      <button type="button" disabled style={actionPillDisabled}>
        <L en={en} ar={ar} />
      </button>
      <span style={actionReason}>
        <L en={reason.en} ar={reason.ar} />
      </span>
    </span>
  );
}
