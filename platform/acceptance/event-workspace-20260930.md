# Event workspace update — 30 September 2026

Requested by the owner: matching end/start defaults, numbered Medical Director section, stable event identity and tabs, and a separate Submit checklist.

## Changed

- New-event and preparation forms copy start date to end date and opening time to closing time until the user changes the corresponding end field. Saved dates and times are preserved.
- Overview, Requirements, Medical Director, EMS agencies and Submit share one event header, including both names, record/reference numbers, date, level and deadline.
- The Medical Director preparation section is numbered 3 when documents and EMS sections precede it.
- Submit separates required and optional items. Links lead to the relevant form. Declaration and contact completion update immediately; the existing server submission gate is still authoritative.
- Recommended Level 2 plans remain optional unless specifically requested by the Ministry.

## Verification

- TypeScript and production build.
- 482 unit/integration checks.
- Browser checks for identical header/navigation positions at desktop and phone widths in English and Arabic, no horizontal page overflow, date/time defaults and manual overrides, preparation numbering, and required/optional separation.
- Full English/Arabic organizer submission, Ministry determination and organizer document journeys.

## Separate unfinished work

This change does not implement the newly agreed Medical Director approval step for Level 3 plans. The earlier completion rule remains until that separate workflow is implemented. Email/OTP activation and the Supabase migration are not part of this update.
