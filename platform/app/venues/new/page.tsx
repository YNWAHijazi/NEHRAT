import { redirect } from 'next/navigation';
import { GovernmentBand, Header } from '../../../components/Header';
import { L } from '../../../components/L';
import { SequenceFooter } from '../../../components/SequenceFooter';
import { RegisterVenueForm } from './RegisterVenueForm';
import { currentAccount, organizationFor } from '../../../lib/auth';
import { unreadCountFor } from '../../../lib/queries';
import { VENUE_APPLICABILITY_INTRO, VENUE_REGISTRATION_FIELDS } from '../../../lib/rules';

/**
 * Register a recurring venue. Eligibility asks what the recurring-venue minimum
 * condition asks -- the wording and the threshold both come from the rules data.
 * An ineligible answer is not a determination; the Ministry makes the final call.
 */
export default async function RegisterVenuePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const account = await currentAccount();
  if (!account) redirect('/signin');
  const organization = organizationFor(account.id);
  const unread = unreadCountFor(account.id);
  const { notice } = await searchParams;

  return (
    <>
      <GovernmentBand />
      <Header account={account} organization={organization} unreadCount={unread} showBack={true} />
      <main data-pad="" style={{ maxWidth: 1160, marginInline: 'auto', padding: '44px 32px 120px' }}>
        <div style={{ maxWidth: 900 }}>
          <h1 data-sec-h1="" style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 600, letterSpacing: '-.035em' }}>
            <L en="Register a recurring venue" ar="تسجيل موقع فعاليات دوري" />
          </h1>
          <p data-region="applicability-intro" style={{ margin: '0 0 36px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.6, maxWidth: '74ch' }}>
            <L en={VENUE_APPLICABILITY_INTRO.en} ar={VENUE_APPLICABILITY_INTRO.ar} />
          </p>
          <div data-region="required-note" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '15px 21px', background: 'var(--surface2)', borderRadius: 10, marginBlockEnd: 32, fontSize: '14.5px', color: 'var(--muted)', maxWidth: '74ch' }}>
            <span style={{ flex: 'none', padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 999, fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase' }}>
              <L en="Required" ar="مطلوب" />
            </span>
            <span style={{ lineHeight: 1.6 }}>
              <L en="Every field is required unless marked optional." ar="كل حقل مطلوب إلا ما وُسم اختيارياً." />
            </span>
          </div>

          {notice === 'outside' ? (
            <div style={{ padding: '26px 30px', border: '1px solid var(--line)', background: 'var(--surface2)', borderRadius: 16, marginBlockEnd: 20 }}>
              <div style={{ fontSize: 16, lineHeight: 1.65, marginBlockEnd: 12 }}>
                <L
                  en="On these details the venue falls outside the annual assessment. The Ministry determines applicability where it is uncertain, so this is not a determination that the venue is outside the process."
                  ar="بحسب هذه المعطيات يقع الموقع خارج التقييم السنوي. تتخذ الوزارة القرار النهائي عند عدم اليقين بالانطباق، ولذلك لا يُعتبر هذا قراراً بأن الموقع خارج الآلية."
                />
              </div>
              <a href="/notifications" style={{ fontSize: 15, borderBlockEnd: '1px solid var(--brand)', paddingBlockEnd: 2 }}>
                <L en="Contact the Ministry about applicability" ar="مراسلة الوزارة بشأن الانطباق" />
              </a>
            </div>
          ) : null}

          <RegisterVenueForm fields={[...VENUE_REGISTRATION_FIELDS]} />

          <div data-region="exempt-footnote" style={{ padding: '23px 27px', background: 'var(--surface2)', borderRadius: 12, marginBlockStart: 20, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
            <L
              en="A specific event held at this venue may still enter the process on its own criteria. Registering a venue does not exempt events held there."
              ar="قد تدخل فعالية بعينها تُقام في هذا الموقع في الآلية بحسب معاييرها الخاصة. تسجيل الموقع لا يعفي الفعاليات التي تُقام فيه."
            />
          </div>
        </div>

        <SequenceFooter
          labelEn="Next in the sequence"
          labelAr="التالي في التسلسل"
          steps={[
            {
              href: '/dashboard',
              en: 'Dashboard',
              ar: 'اللوحة',
              descEn: 'Every record on this account, and what each one owes.',
              descAr: 'كل سجل على هذا الحساب وما يستحق على كل منها.',
            },
          ]}
        />
      </main>
    </>
  );
}
