# Short first-use tour — 29 September 2026

Reference: the owner's three Caliber screenshots. A dimmed page, a spotlight on an existing control, a short card, Back / Next / Skip / Done, and no decorative icons.

## Behaviour

- New real accounts see the tour on their first dashboard visit. A direct invitation or service link keeps its destination; the tour waits for the dashboard.
- Existing accounts and demo accounts are not interrupted automatically.
- Account menu → Quick tour returns to the role's dashboard and replays it.
- Seeing the tour records the preference on the signed-in account, including if the user skips, reloads, or leaves it unfinished. It follows the account across browsers. A per-account tab cache prevents cached navigation from reopening it. If the server cannot save the preference, the card says so.
- English and Arabic, logical layout, narrow-screen wrapping, native modal keyboard focus, Escape to close, and focus restored to the account menu. No animation or page-layout changes.
- Missing or hidden targets use a centred card. The spotlight is visual guidance; Back and Next move through steps without clicking or submitting the underlying controls.

## Content

| Role | Guidance |
| --- | --- |
| Organizer | Choose a service; add files and invite the medical team; review and submit; follow updates and download the issued certificate. |
| EMS | Open an invitation; share coverage/staffing; use the shared medical plan. |
| Medical Director | Open an invitation; share arrangements; use the shared medical plan. |
| Ministry reviewer/admin | Choose the service; open and review a submission; check updates. |
| Platform owner | Users, roles, settings, activity and records; service totals. |
| Order reviewer | Referred-event review, if the separate existing lane is enabled. This tour does not enable that lane. |

Medical plan text preserves the agreed workflow: EMS or Medical Director can complete the shared plan; the organizer reads their answers. This change does not alter level requirements, permissions, submission gates, email setup or OTP.

## Maintenance

Edit `lib/quick-tour.ts` for the English/Arabic titles, sentences and target selectors. Presentation is in `components/QuickTour.tsx` and `components/QuickTour.module.css`. Persistence is a `tour_pending` account column and an insert trigger for new non-demo accounts, with an authenticated server action to clear it. Migration defaults existing accounts to no automatic tour.

## Verification

TypeScript and production build passed. Unit checks include migration from a pre-tour account table, new account eligibility, demo exclusion, anonymous refusal and account isolation. Browser checks cover every active demo role, mobile English/Arabic, keyboard focus, Escape, Back/Next/Done/Skip, missing targets, and a real test signup followed by a fresh browser sign-in. Existing mobile navigation and reviewer workflow checks are included in the final run.

Final local result: 482 unit/integration checks, 24 focused browser checks, TypeScript and production build passed. Desktop and mobile Arabic/English screenshots inspected.
