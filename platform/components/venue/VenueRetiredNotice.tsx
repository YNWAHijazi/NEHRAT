import Link from 'next/link';
import { L } from '../L';
import { getDb } from '../../lib/db';
import { siteIdForVenue } from '../../lib/sites';

/**
 * HOSTING VENUE REGISTRATION IS REPLACED BY FACILITY/SITE REGISTRATION (owner, 9 October 2026;
 * latest revision: "No annual venue NEHRAT, venue Level, venue certificate, VN-ID"). Every venue
 * record stays as it was -- nothing is deleted -- and reads as history. The owner is offered the
 * route onward: register the place as a Facility/Site, with the venue's identity and
 * infrastructure answers carried into the new registration by the facility service
 * (/facilities/new?fromVenue=VN-nnnn). Where the account already holds a Facility/Site
 * registration on the venue's site, the notice opens that record instead.
 */
export function VenueRetiredNotice({ venueId, accountId }: { venueId: string; accountId: number }) {
  const site = siteIdForVenue(venueId);
  const facility = site
    ? (getDb().prepare(`SELECT id FROM facilities WHERE site_id = ? AND account_id = ? AND archived_at IS NULL ORDER BY id LIMIT 1`).get(site, accountId) as { id: string } | undefined)
    : undefined;
  return (
    <div role="status" data-region="venue-retired" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', background: 'var(--accent-soft)', borderInlineStart: '3px solid var(--accent)', borderRadius: 12, marginBlockEnd: 24 }}>
      <p style={{ flex: '1 1 320px', minWidth: 0, margin: 0, fontSize: '14.5px', lineHeight: 1.7 }}>
        <L
          en="Hosting venue registration is replaced by facility/site registration. This record is kept as it was and is read-only. Events now link to the registered facility/site."
          ar="حلّ تسجيل المنشأة/الموقع محلّ تسجيل الموقع المستضيف. يُحفظ هذا السجل كما هو وللقراءة فقط. وترتبط الفعاليات الآن بالمنشأة/الموقع المسجّل."
        />
      </p>
      {facility ? (
        <Link href={`/facilities/${facility.id}`} data-action="open-facility-site" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500 }}>
          <L en="Open the facility/site record" ar="فتح سجل المنشأة/الموقع" />
        </Link>
      ) : (
        <Link href={`/facilities/new?fromVenue=${encodeURIComponent(venueId)}`} data-action="register-as-facility-site" style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, paddingInline: 22, borderRadius: 22, background: 'var(--brand)', color: 'var(--bg)', fontSize: '14.5px', fontWeight: 500 }}>
          <L en="Register this place as a facility/site" ar="تسجيل هذا المكان كمنشأة/موقع" />
        </Link>
      )}
    </div>
  );
}

/** The Ministry's side of the same change: the venue file is history, and no outcome is recorded on it. */
export function VenueRetiredMinistryNotice() {
  return (
    <div role="status" data-region="venue-retired" style={{ padding: '16px 22px', background: 'var(--surface2)', borderInlineStart: '3px solid var(--line)', borderRadius: 12, marginBlockEnd: 24, fontSize: '14.5px', lineHeight: 1.7 }}>
      <L
        en="Hosting venue registration is replaced by facility/site registration. This file is kept as it was and is read-only; no outcome is recorded on it."
        ar="حلّ تسجيل المنشأة/الموقع محلّ تسجيل الموقع المستضيف. يُحفظ هذا الملف كما هو وللقراءة فقط؛ ولا تُسجَّل عليه أي نتيجة."
      />
    </div>
  );
}
