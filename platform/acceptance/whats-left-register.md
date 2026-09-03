# Register of remaining work

Compiled 2026-09-03 from the repository's own records (open-decisions, the pass
registers, deferred data, code-comment seams, the visual manifest, the guard
suites), deduplicated against what later commits closed. Two structural edits by
partner instruction, 2026-09-03: the signature question stands alone at the top
of §1 as the sequencing blocker it is, and the lookup rate limit moved from
infrastructure to §3 as a live security gap.

## 1 · Decisions only the Ministry or partner can make

### THE SEQUENCING BLOCKER

**What a signature is** (open-decisions #9). Six surfaces capture a
certification with no signature control: the assessment declaration, the
compliance certification, the post-event report, the facility plan confirmation,
device registration, and the facility incident report. One answer unblocks six
surfaces. Nothing else on this register has that leverage.

### The rest of the open decisions register

- What a material change does to a filed submission (#6) — reopen, void, or
  reviewer judgment; inert today by design caution.
- Capturing the external authorization both §8.1 limbs turn on (#7).
- The interim email filing channel and its supersession (#8).
- The two applicability criteria captured nowhere (#2).
- Level 1's responsible organizer contact (#4).
- Insurance evidence (#10) — likely closed by the attachment build; the register
  entry was never closed.
- The Event Medical Director's licensure — asserted, never checked (#11).
- The medical provider's own surface (#14).
- Aggregate publication, surveillance, quality improvement — post-event data
  feeds nothing (#16).
- Enumeration hardening for the public lookup (#17) — the decision on the
  durable mechanism; the current exposure is §3.
- Facility readiness depth — two of nine requirements are self-attested
  checkboxes (#18).
- The attestation-lane fallback while the Order lane is off (#19).

### From the capabilities batch

- The assistants' data reach (the deferred 'assistance' condition).
- The platform-intelligence contradiction — full tenant visibility against
  counts only; on its page, blocking its toggle.
- Whether a fee exists at all (the deferred 'commercial' condition) — the
  machinery now waits only on that.

### Small rulings from the walks

- The masthead using الجاهزية on the event side (B-12; one string).
- Demonstration rows in the owner's counts (B-13).
- Level 2's labelled "no declaration" slot — named absence or absent (B-14).
- The anonymous demonstration sign-in panel in deployed environments (B-15).
- Whether the Director may sign the post-event report before the organizer
  (B-16).
- The first-response nomination tension — SPEC rule 6 names them; invitations
  accept only ems/director.
- Whether the owner keeps the organizer surface it currently also holds.

### The EN/AR divergence set — SETTLED by standing ruling (2026-09-03)

English governs, everywhere, without exception: where the Arabic issue says
more, says it more strongly, or orders things differently, the rendered Arabic
carries the English limbs only, and the set-aside wording is recorded in the
data beside each string for the Ministry. Applied to every recorded divergence
(Part F's extra qualifiers; items 7 and 10 of the readiness declaration;
requirement rows 7, 13 and 15 — row 13's built English had carried the Arabic
limb too and shed it; the two Annex C omissions, where English governing means
the fields render). Future divergences take the same rule on discovery, without
a per-item decision. Two divergences were source-internal rather than EN/AR and
stay open elsewhere in this register: the responsibility sentence, and Level
1's "not routinely required" vs "only when requested".

## 2 · Deliberately not built, waiting on the above

The four assistants themselves (governance precedes them, by design). The
payment provider (the seam waits; a fee-bearing submission sits honestly at
awaiting payment). Mail transport — nomination links, notifications, resets.
Postgres and data residency (node:sqlite is the review store; the swap is
confined to db + queries). The Order reviewer's console. A facility reference
scheme. Ministry account minting stays a script — no console create-user.

## 3 · Recorded build gaps still live

**Live security gap: the public lookup's enumeration guard is theatre after any
deploy.** The rate limit is a per-process in-memory counter — it dies on every
restart and never existed across instances, so after a deploy or a scale-out
the sequential-reference register is walkable until the process warms. The
event-date second factor is the only durable defence today. The decision on the
durable mechanism is §1 (#17); the exposure is live now.

Annex A Part F's certification statement renders nowhere. The expedited flag is
derived and stored but no console surface reads it. Cardiac powers 1, 2, 4, 5
and 9 publish into a void — no consumer. §13 ¶2(b) configured but never
evaluated; §13 ¶2(c) has no Ministry request control. Annex B §6.2's
status-change routes (after AED use; on readiness request) missing; the
incident report omits category and address; device readiness checks not asked
at initial registration; malls have no capacity field for a threshold to
evaluate; the Level-1 measures selector cannot request the compliance form or
plan. The configuration console cannot publish a version or show history;
registry drill-downs are flat; PAD §12's cross-module references unbuilt.
Organizer small items: mark-all-read, acknowledgment preview, replace-a-file,
resume a part-answered assessment. Arabic dual number agreement ("2 بنود").
From the capabilities batch: the fee filing gate covers events only — venue and
facility fees render on the service pages but their registration flows have no
payment gate; sponsorship and advert bookings record no payment mechanics.

## 4 · Verification debt

Journeys 3–10 and 12 walked in English only. Twenty-five manifest regions have
no reference-side locator — the fidelity claim on them is formally withdrawn;
five screens never compared at all (builtRoute null). Restore-by-designation
not machine-walked. Guard blind spots, recorded: rules-wiring cannot see
alias-only imports; the fidelity-claim detector is a hand-written vocabulary.
And the one check nobody here can perform: the Ministry reading the screens
against its own instruments.

## 5 · Infra debt

The dev-server memory-watchdog restart is the named cause of the e2e flake
family — mitigated (heap cap, retry helper, two workers, serialized files),
not fixed; it rotated through four different specs in one session. The review
machine's disk needs a clearing pass before every verify chain, under the
absolute rule: nothing outside the repository is ever deleted; blessed caches
only, and only when asked.
