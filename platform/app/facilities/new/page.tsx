import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { RegisterFacilityForm } from './RegisterFacilityForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { publishedFacilityValues, unreadCountFor, venueById } from '../../../lib/queries';
import { venueSiteForNewFacility } from '../../../lib/sites';
import { accountContact } from '../../../lib/account-contact';

/**
 * Register a facility: steps 1-3 of the six. Step 2 is a determination, not a form,
 * and for the categories awaiting a Ministry value it ends the journey -- no Continue
 * button exists there (ROADMAP 2d; rule 10's absent behaviour).
 */
export default async function RegisterFacilityPage({searchParams}:{searchParams:Promise<{error?:string;fromVenue?:string}>}) {
  const {error,fromVenue}=await searchParams;
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  // From a hosting venue's PAD and AED step: only the venue's owner, and only while its site has no facility yet.
  const venue = fromVenue && venueSiteForNewFacility(account.id, fromVenue) ? venueById(account.id, fromVenue) : null;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBlockEnd: 12 }}>
          <L en="Cardiac-arrest readiness · new facility registration" ar="الجاهزية لتوقف القلب · تسجيل منشأة جديدة" />
        </div>
        <h1 data-sec-h1="" style={{ margin: '0 0 32px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
          <L en="Register a facility" ar="تسجيل منشأة" />
        </h1>
        {/* The six-steps overview sentence left this screen (partner ruling, second
            sweep): the step rail below already shows the steps, and the category
            step explains itself when reached. */}
        {error?<p role="alert"><L en="Complete the required contact details and confirm the facility map pin." ar="أكملوا بيانات الاتصال المطلوبة وأكّدوا موقع المنشأة على الخريطة."/></p>:null}
        {venue ? (
          <p data-region="from-venue" style={{ margin: '0 0 24px', padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: '14.5px', lineHeight: 1.6 }}>
            <L en={`This facility registration is for the same place as the hosting venue ${venue.nameEn} (${venue.id}). The two registrations stay separate; the venue shows this facility's AEDs.`} ar={`تسجيل المنشأة هذا للمكان نفسه الذي يشغله موقع الاستضافة ${venue.nameAr} (⁦${venue.id}⁩). يبقى التسجيلان منفصلين؛ ويعرض الموقع أجهزة إزالة الرجفان المسجّلة لهذه المنشأة.`} />
          </p>
        ) : null}
        <RegisterFacilityForm published={publishedFacilityValues()} me={accountContact(account.id)} fromVenue={venue ? { id: venue.id, nameEn: venue.nameEn, nameAr: venue.nameAr, addressEn: venue.addressMunicipalityEn, addressAr: venue.addressMunicipalityAr } : null} />
      </main>
    </>
  );
}
