# Role workflow review — 29 September 2026

Status: published to production on 29 September 2026. Application commit: `1853db45a40e41fb08b70b13178d752f1be977ad`.

## Confirmed policy

The owner confirmed that either the event's confirmed EMS agency or confirmed Medical Director can complete the shared medical plan. No separate Director approval is required. A Level 3 event still requires a named, confirmed Medical Director and the Ministry still reviews the application.

| Role | Work to complete | What they can read |
|---|---|---|
| Organizer | Event details and assessment, their documents, invitations, declarations and submission | All shared medical-plan answers; separate Director and EMS tabs; agency arrangements and signed declarations; Ministry requests and decisions |
| EMS agency | Accept invitation; share operational arrangements; Level 3 readiness declaration; prepare the shared plan where applicable | Relevant event details and shared files; the same medical plan as the Director |
| Medical Director | Accept invitation; shared medical plan; Level 3 medical arrangements and deployment map | Relevant event details and the same plan as EMS |
| Ministry reviewer | Read evidence, record required reviews, request corrections or additional measures, record a decision | Event facts, organizer declarations, actual uploaded files, assessment answers, agency operational details and signed declarations, Director arrangements and latest shared plan |

Private EMS declaration drafts are not exposed to organizers or reviewers. “Provided” means evidence exists, not that the Ministry has approved it.

## Level rules

- Level 1: no medical-plan requirement.
- Level 2: medical plan recommended, required only on an active Ministry request. No mandatory Level 3 major-incident checklist.
- Level 3: shared plan and major-incident checklist required; either confirmed medical party can complete them.
- The same section list drives medical-plan entry, completion and reviewer presentation.

## Fixed in this pass

- Reviewer saw Level 3 checks on Level 2 plans: removed those checks and added an explicit required/recommended statement.
- Reviewer lacked operational answers and Director arrangements: added attributed, read-only evidence panels and signed agency declarations.
- Review had assessment scores without a concise event brief: added dates, times, location, attendance and organizer contact.
- Reviewer saw internal activity keys: replaced with the same bilingual labels used in entry.
- Optional documents could look like missing requirements: separated applicability from whether evidence was provided.
- Stored filename alone could mark an upload complete: now requires actual stored bytes.
- Medical team was told to wait for an organizer-written plan: corrected shared-plan guidance.
- EMS saw an unsavable operational form before accepting: show that form only after acceptance.
- Detailed operational answers were squeezed into single-line fields: use multiline fields and optional, specific prompts.
- Director text state depended on an arbitrary length: indicate saved text rather than guessing its quality.
- Short organizer guidance explains the handoff without adding a long introduction.

## Record/version limitation

Review shows the latest shared plan, its editor and timestamp, with an explicit warning if changed after filing. The plan's existing version history remains available. This work does not claim that the whole application is an immutable snapshot of every field/file at filing time.

## Validation

- 479 unit/integration tests passed (47 test files).
- Production build passed after the final source changes.
- 194 distinct application browser checks passed: 108 in the first half and 86 in the second half, using a freshly seeded disposable database for each.
- The focused preliminary run passed 27/28; the new failing test expected “Clinical governance” while the actual heading was “Clinical-governance arrangements.” Its assertion was corrected to verify the real saved answer; it passed in the full regression run.
- New browser journeys cover reviewer medical evidence, Level 2 optional-plan presentation, multiline EMS-to-organizer handoff, Arabic and phone layouts. Screenshots were inspected.
- Git whitespace validation passed.
- Six live checks passed after deployment: public sign-in; organizer Level 2 recommendation and read-only plan; EMS shared plan and multiline answers; Director Level 3 plan entry; Ministry event/evidence review; Arabic mobile Level 2 review without overflow.
- Live checks used demonstration accounts and did not change event content.
- Railway status: **SUCCESS**. Deployment: `7aaa3d37-62c7-40d3-ae01-62ebeab8c8de`, from GitHub commit `1853db45a40e41fb08b70b13178d752f1be977ad`.
- GitHub push did not start an automatic deployment. The release was triggered with Railway’s `redeploy --from-source` for the existing production service. The first live request returned 502 during rollout; the instance subsequently started and all six live checks passed.

## Outside this update

Email sender/domain and OTP activation remain postponed at the owner's request. Supabase migration and production backup automation are separate launch work. This workflow update alone is not a claim that public launch preparation is complete.

## Status wording added or clarified

| English | Arabic | Trigger | Screen |
|---|---|---|---|
| Required | مطلوب / مطلوبة | Requirement applies at this level, including an active Level 2 Ministry plan request | Medical task card; review document list |
| Recommended — not required to submit | موصى بها — ليست شرطاً للتقديم | Level 2 plan without an active Ministry request | Medical task card; Ministry plan review |
| Not required for this level. | غير مطلوبة لهذا المستوى. | Level 1 medical plan | Ministry plan review |
| Optional | اختياري | Additional supporting document outside required items | Review document list |
| Provided | مقدّم | Actual file bytes or applicable saved form completion exists | Review document list / plan sections |
| Not provided | غير مقدّم | No saved answer or actual file for the item | Review evidence and document list |
| Confirmed by organizer | أكّده المنظّم | Organizer checked the declaration | Organizer declarations in review |
| Confirmed by agency | أكّدته الجهة | Agency signed its declaration with this item confirmed | Signed EMS declaration in review |
| Not submitted | غير مقدّم | EMS declaration remains unsigned; draft answers stay private | Agency declaration in review |
| All sections provided | جميع الأقسام مقدّمة | Shared plan passes the same section-completion rule as filing | Medical task card |
| Saved | محفوظ | Director has saved non-empty arrangements; no quality inference by text length | Director arrangements |
| This plan changed after the application was submitted. Review the updated answers. | تغيّرت هذه الخطة بعد تقديم الطلب. راجعوا الإجابات المحدّثة. | Plan save timestamp follows filing timestamp | Ministry plan review |
