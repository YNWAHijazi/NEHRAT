import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RegisterFacilityForm } from './RegisterFacilityForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { publishedFacilityValues, unreadCountFor, venueById } from '../../../lib/queries';
import { venueSiteForNewFacility } from '../../../lib/sites';
import { accountContact } from '../../../lib/account-contact';
import { siteEventVenueThreshold } from '../../../lib/facility-gis';
import { beirutToday } from '../../../lib/clock';
import { FACILITY_CONTENT } from '../../../lib/rules';

/**
 * Register a facility/site: one page (latest revision, 9 October 2026, sections 1 and 2) --
 * the short explanation, the covered category, the site profile and its map pin, what a
 * responding crew needs and the one responsible contact, then one Continue onto the record's
 * step path. The category is a determination, not a form: an event-hosting venue below the
 * capacity threshold is not covered and no Continue is drawn; a designated category registers,
 * and only the Ministry's designation makes it apply.
 */
export default async function RegisterFacilityPage({searchParams}:{searchParams:Promise<{error?:string;fromVenue?:string}>}) {
  const {error,fromVenue}=await searchParams;
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  // From a hosting venue: only the venue's owner, and only while its site has no facility yet.
  const venue = fromVenue && venueSiteForNewFacility(account.id, fromVenue) ? venueById(account.id, fromVenue) : null;
  const site = FACILITY_CONTENT.site;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="Cardiac-arrest readiness · new facility/site registration" ar="الجاهزية لتوقف القلب · تسجيل منشأة/موقع جديد" />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 16px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Register a facility/site" ar="تسجيل منشأة/موقع" />
        </h1>
        <p data-region="site-intro" style={{ margin: '0 0 32px', fontSize: 16, lineHeight: 1.65, maxWidth: '70ch' }}>
          <L en={site.introEn} ar={site.introAr} />
        </p>
        {error === 'capacity' ? <p role="alert"><L en="This category covers venues at or above the published capacity threshold. Check the capacity, or choose the category that applies." ar="تشمل هذه الفئة المواقع التي تبلغ عتبة السعة المنشورة أو تتجاوزها. تحقّقوا من السعة أو اختاروا الفئة المنطبقة." /></p>
          : error ? <p role="alert"><L en="Complete the required details, including the operating organization, and confirm the map pin." ar="أكملوا البيانات المطلوبة، بما فيها الجهة المشغّلة، وأكّدوا موقع المنشأة على الخريطة." /></p> : null}
        {venue ? (
          <p data-region="from-venue" style={{ margin: '0 0 24px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.6 }}>
            <L en={`This facility/site is the same place as the hosting venue ${venue.nameEn} (${venue.id}). Its site is reused, and the venue’s infrastructure answers and layout map are copied into the site record.`} ar={`هذه المنشأة/الموقع هي المكان نفسه الذي يشغله موقع الاستضافة ${venue.nameAr} (⁦${venue.id}⁩). يُعاد استخدام موقعه، وتُنسخ إجابات البنية الأساسية للموقع وخريطة مخططه إلى سجل الموقع.`} />
          </p>
        ) : null}
        <RegisterFacilityForm
          published={publishedFacilityValues()}
          eventVenueThreshold={siteEventVenueThreshold()}
          today={beirutToday()}
          me={accountContact(account.id)}
          organization={organization ? { en: organization.nameEn, ar: organization.nameAr } : null}
          fromVenue={venue ? { id: venue.id, nameEn: venue.nameEn, nameAr: venue.nameAr, addressEn: venue.addressMunicipalityEn, addressAr: venue.addressMunicipalityAr } : null}
        />
        </div>
      </main>
    </>
  );
}
