# The wiring sweep — lib/rules exports with no production caller

Recorded before any fix, per instruction. State as of commit 43b8515. Method: every
`export function/const/class` in `lib/rules/*.ts`, checked for non-import references in
production code (`app/**` and `lib/**`, excluding tests and the `index.ts` re-export barrel).
Own-file internal use separates a private helper (fine) from a dead export.

## Truly unwired — an obligation or rule exists with no discharge path

| Export | File | Unit-tested? | What it was supposed to do | Disposition |
|---|---|---|---|---|
| `effectiveCycles` | ministry.ts | **yes — vacuous** | Published readiness cycles override the provisional 90/60 | **Wire** (showstopper 5) |
| `postEventSignaturesRequired` | load.ts | no | Which signatures Annex D needs at the derived level | **Wire** — `actions.ts:469` reads `demo_level` instead (the Director-signature bug) |
| `SERIOUS_INCIDENT_NOTIFICATION` | load.ts | no | The 24-hour notification content | **Wire** (showstopper 3) |
| `COMPLIANCE_HEADER` | content.ts | no | The eight Annex C header fields | **Wire** — the submit screen hand-writes six of eight |
| `commandFunctionRow` | requirements.ts | no | Requirement 15's row, Director-alone | **Wire** — both consumers re-derive it inline |

## Dead duplicates — a second, wired derivation exists elsewhere

The exact failure CLAUDE.md's "no screen implements its own gating" exists to prevent,
inverted: the rules module carries the orphan while the live derivation sits elsewhere.

| Export | File | Unit-tested? | The wired twin | Disposition |
|---|---|---|---|---|
| `submitGate` | gates.ts | no | `lib/rules/submission.ts` (blockers) | **Delete** |
| `readinessDeclarationGate` | gates.ts | no | `lib/rules/roles.ts` `declarationGate` | **Delete** |
| `postEventReportIsOpen` | deadlines.ts | **yes — vacuous** | `gates.ts` `postEventReportGate` | **Delete** |
| `BANNED_TERMS` | load.ts | no | test imports the JSON directly | **Delete export**, point the test at one source |

## Stale policy — unwired AND contradicting a later ruling

| Export | File | Unit-tested? | Problem | Disposition |
|---|---|---|---|---|
| `SURFACE_DEMONSTRATION_POLICY` | scope.ts | **yes — vacuous** | Declares `reviewerQueue: excludeDemonstration`, written before the Slice 6 symmetric-isolation ruling; `lib/queries.ts` implements symmetric `is_demo = ?` inline | **Rewrite to the symmetric semantics and wire queries through it** |
| `MINISTRY_WORK_SURFACES` | scope.ts | **yes — vacuous** | Same module | with the above |
| `applyDemonstrationFilter` | scope.ts | **yes — vacuous** | Same module | with the above |
| `demonstrationFilter` | scope.ts | **yes — vacuous** | Same module | with the above |

## Cleared on inspection — private helpers, transitively reachable

`toBeirut`, `fromBeirut`, `startOfBeirutDay`, `addDays` (deadlines.ts), `evaluateClause`,
`evaluatePredicate` (predicate.ts), `evaluateMinimumConditions` (derive.ts), `addMonthsIso`,
`obligationStatus` (facility.ts), `projectPublicLookup`, `PUBLIC_LOOKUP_FIELDS`
(public-lookup.ts — used by `resolvePublicLookup`, which the route calls), `TIMEZONE`
(load.ts). Each is used inside its own module by a function that production code calls;
their unit tests test reachable behaviour.

## The vacuous-test count

Eight unit-tested exports had no production caller: `effectiveCycles`,
`postEventReportIsOpen`, and the four scope.ts exports, plus two cleared as transitive on
inspection (`toBeirut`, `obligationStatus` were flagged by the first pass and cleared by the
own-file check). Net: **six genuinely vacuous tests** across two modules — the suite asserted
behaviour the platform never executed.

## The guard

`tests/rules-wiring.test.ts` (added with the fixes) re-runs this analysis on every verify:
each `lib/rules` export must carry at least one non-import reference in production code
beyond its own definition — own-file helper use counts, `index.ts` re-exports and test files
do not. The allowlist in the test is empty and stays empty; an export that loses its last
caller fails the build with this file's vocabulary: "unwired rule".

## Companion sweep — EN/AR datasets zipped by index

The Annex B rows 16/17 mispairing (EN and AR issues order the two rows differently;
divergence 9 in the source-documents README) prompted a pairing check across every
`lib/rules/data/*.json` bilingual pair: a numeral-anchor comparison (digits survive
translation) across all files, plus the six audit passes' row-by-row reads against both
issues. Result: the mispairing is isolated to requirements-matrix rows 16/17 — the four
numeral mismatches the check raised are Arabic number-words (الثاني والثالث, ألف,
الاثني عشر), verified false positives. Rows 16/17 are fixed by content in the same commit;
the `prototypeAr` fields show the prototype had the pairing right all along.
