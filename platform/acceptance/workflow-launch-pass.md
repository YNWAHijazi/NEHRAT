# Workflow pass — 11 September 2026

## Product workflow

Event: start service → enter facts and assessment → work through documents one at a time → invite EMS and, where required, a Medical Director → review declarations and submission → Ministry review → prominently accessible preparedness certificate → post-event report → archive and Duplicate event for a new edition.

The certificate records Ministry health/medical preparedness. It is not an event licence; the competent authority retains event authorisation under the source documents. Only the current determination is presented as current. A duplicate remains a new application, with new dates, a recalculated level, fresh nominations and no inherited approval.

Venues retain annual classification/reassessment and facilities retain ongoing readiness/renewal, rather than being converted to event-specific submission or annual duplicate records. Venue progress is collapsed by default. Facilities now surface outstanding/lapsing tasks with links to the relevant controls. Their existing records and history remain available.

## Implemented in this pass

- New event assessments continue directly to requirements. One document card open at a time, initially the first unfinished required item. Other requirements remain directly selectable.
- Event certificate access placed before the progress timeline.
- Archive naming and clearer Duplicate event action on concluded events.
- Anonymous invitation viewing still shows the role-scoped briefing/documents. Anonymous acceptance stays pending until an account is created or an existing account signs in. An already signed-in eligible role can accept. A linked invitation cannot be reassigned through the sign-in action.
- Invitation emails and account activation/reissue emails through SMTP. Delivery outcomes are explicit. Demo accounts never send external email, even if SMTP is configured.
- Master-admin overview of account/event/venue/facility counts and email configuration/delivery counts.
- Ministry post-event report inbox, with aggregate report contents and an acceptance action. Acceptance records the reviewer, time, and submitted-report timestamp; repeat acceptance is idempotent. Organizers see the accepted state and receive an in-app notification. Owners can read reports but cannot record Ministry acceptance.
- Director's second signature now submits a report already signed by its organizer. Submitted reports cannot be overwritten through the save action; editing a draft invalidates its signatures.

## Administration responsibilities

| Control | Ministry administrator | Platform owner |
| --- | --- | --- |
| Add users, invite/reissue activation, suspend/restore, change assignable roles | Yes, subject to protected-account rules | Yes, subject to protected-account rules |
| Read records, attachments and operational activity | Yes | Yes |
| Record Ministry outcomes, attestations and post-event report acceptance | Yes | No; these remain attributed to Ministry staff |
| Configure mass-gathering policy | Yes | Yes |
| Configure cardiac policy | Yes | No; retained as Ministry policy authority |
| Fees, vendor directory, AED purchase links, other optional capabilities | No | Yes, through existing configuration pages |
| View submitted post-event reports | Yes | Yes |

“Full control” means operational management with attributable actions. It does not mean changing signed history, viewing passwords, or impersonating another role. Ministry administrators can add further Ministry administrators/reviewers using Users and roles without code changes. Existing feature pages already support fee amounts, currency and vendor listings, and require their prerequisites before enabling. Features remain off; no Ministry approval is implied by this work.

## Email configuration

The sender choice and credentials are still outstanding. See `email.env.example`; configure its server-only variables in the relevant Railway environment. `APP_BASE_URL` must be the public HTTPS URL. The SMTP implementation requires verified TLS, follows [Nodemailer SMTP documentation](https://nodemailer.com/smtp), and does not log invitation tokens, passwords, message bodies, or raw SMTP diagnostics. “Sent” means the SMTP server accepted the message, not proof of inbox delivery. Unconfigured or failed delivery retains the usable invitation/activation link.

No real emails were sent during testing. Production sender verification, bounce handling, and an actual invitation delivery check remain required before launch. The current implementation sends synchronously with bounded timeouts; it is not a background retry queue.

## Separate deployment work

These changes are local. Supabase schema/data migration, production cutover, and the hosted staging/publishing workflow remain separate unfinished work. No Railway deployment has occurred.

## Review of existing configuration

The existing vendor directory and AED purchase-link components already filter the relevant AED supply/pads/battery categories and disappear while their feature flags are off. Existing account management provides activation, role assignment, suspension and reinstatement; no administrator needs to set another user’s password. Existing fee configuration is a capability, not a configured payment gateway: selecting fee amounts does not by itself connect a payment processor. Features have not been enabled in this pass.

A dependency audit reported existing package advisories during installation. Dependency remediation and a complete deployment validation remain on the prelaunch list; the targeted workflow tests are not a production-readiness certification.

## Validation

TypeScript checking passed; 424 unit tests passed across 41 files. The final targeted browser run passed all 19 checks covering facilities, English/Arabic organizer submission and certificate journeys, invitation account requirements, sequential document entry, owner overview, and both report signatures through Ministry acceptance. Separate account-management, event-duplication, and mobile requirement checks also passed during this pass. `git diff --check` passed. No production build/deployment or live email delivery was validated.
