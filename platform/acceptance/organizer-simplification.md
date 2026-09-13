# Organizer simplification — 11 September 2026

The organizer can prepare a package while Ministry registration and nominated-party responses are pending. The next-action panel now reflects that behavior. Filing permissions and regulatory requirements have not changed.

The event identity now precedes the next action. The current-stage note stays visible; the full six-stage timeline opens on demand with a keyboard-accessible disclosure. Invitation help explains sharing the link without technical token terminology or implying email delivery.

## Next-action priority and bilingual titles

First matching row wins. These are guidance states, not new submission gates.

| Trigger | English title | Arabic title | Destination |
| --- | --- | --- | --- |
| Missing attachable documents | Attach the outstanding document / Attach the N outstanding documents | أرفقوا المستند غير المقدَّم / أرفقوا المستندات غير المقدَّمة (N) | Requirements |
| Missing plan | Write the event health and medical plan | اكتبوا خطة التأهب الصحي والطبي للفعالية | Plan |
| Missing required Medical Director nomination | Name the Event Medical Director | سمّوا المدير الطبي للفعالية | Requirements |
| Incomplete declarations or representative certification | Complete the compliance and submission form | أكملوا نموذج الامتثال والتقديم | Submission form |
| Organization pending after the organizer’s preparation | Wait for the Ministry to record the organization | انتظروا تسجيل الوزارة للمؤسسة | Organization |
| Pending nominated-party response or declaration | Follow up on the pending response / responses | تابعوا الردّ المعلّق / تابعوا الردود المعلّقة | Requirements |
| Fee unpaid | Awaiting payment | بانتظار السداد | Submission |
| No blockers | File the submission | قدّموا الملف | Submission |

The panel is hidden on filed, cancelled/postponed, and archived event records. The server submission gate remains authoritative. Missing certification now directs the organizer to the form rather than incorrectly claiming readiness.

## Validation

TypeScript and all 419 unit tests pass. Browser validation covers English and Arabic organizer creation through filing, Ministry determination and printing, plus mobile identity order, expandable progress, keyboard interaction and next-action navigation.

## Next prelaunch priorities

1. Walk representative Level 1/2/3 organizers through the simplified requirements screen. Preserve conditional requirements and the existing autosave.
2. Configure delivery before promising emailed invitations or reminders; copy-invitation-link is now available.
3. Test account onboarding, password recovery, event-scoped provider access and Ministry handoff with representative users.
4. Complete the separate Supabase migration rehearsal and recovery check before changing the live database connection.

These changes are local and have not been deployed to Railway.

## Requirements screen — second pass

Three direct section links lead to Documents and plan, Medical team, and Review and submit. At Level 1 the first section is simply Documents. The upload list excludes automatically generated assessment, provider-owned declarations, and the final compliance form. These are still included in the submission package and enforced by the same server gates.

Readiness declaration guidance and signature statuses sit alongside EMS providers at Level 3. The final review card explains the automatically included assessment and links directly to the submission form. Detailed regulatory requirements and inspections remain expandable; the misleading “nothing to do” requirement caption now says “requirements to review”.

Pending invitations offer “Copy invitation link” / “نسخ رابط الدعوة”. A successful copy announces “Link copied” / “نُسخ الرابط”. Clipboard refusal displays “Select and copy the link below.” / “حدّدوا الرابط أدناه وانسخوه.” and expands the selectable full URL. This copies a link only; no email delivery is implied. Provider invitation scope and permissions are unchanged.

Second-pass validation: TypeScript and 419 unit tests pass. All 16 existing nomination/response/submission browser tests passed in the combined run. The new clipboard test initially depended on a demo invitation withdrawn by the preceding test; it now creates its own invitation. It then exposed an upload-control width issue, which was fixed by allowing controls to wrap within their card. All four organizer-simplicity browser tests passed without retries after the fixes, including both languages, clipboard success/fallback, and mobile overflow checks. English and Arabic full-page screenshots were visually reviewed. No full-suite claim is made for this pass.
