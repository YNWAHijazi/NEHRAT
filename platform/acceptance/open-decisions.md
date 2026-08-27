# Open decisions — one page for the Ministry

Eighteen questions the build cannot answer for itself. Each one is a place where two
readings of the instruments are both defensible, so the platform has taken the narrower
one and recorded it rather than guessing. None is a defect; each needs an owner and an
answer before launch.

Where a decision has a **standing behaviour**, that is what the platform does today. It
is reversible; it is not a commitment.

Prepared 2026-08-25 from the Pass A traceability table.

---

## A. Scope of the process — who must enter it, and how they find out

**1. The public entry surfaces.**
Should a member of the public be able to check applicability, look up a reference, and
read the obligation *before* creating an account?
· **Options:** build the public landing, applicability screener and lookup screen (the
original plan) — or keep the platform account-only and publish the applicability rules
elsewhere.
· **Standing behaviour:** account-only. Signed-out visitors reach a sign-in wall; the
applicability screener exists only inside an organizer account.
· **Answer:** Ministry (communications reach) · **Then:** build.

**2. Applicability as a gate, or as the assessment itself.**
Four of the six §3.1 criteria (attendance ≥ 1,000, competition outside routine
operations, recurring venue, previous edition's cardiac arrest or death) are captured
as *scoring inputs* but never as an entry test — nothing asks "are you in scope?"
· **Options:** add an explicit in-scope determination before the assessment — or treat
completing the assessment as the answer.
· **Standing behaviour:** the assessment is the answer. Two criteria — the
authorization trigger and "requires dedicated medical, EMS, traffic or security
arrangements" — are captured nowhere at all.
· **Answer:** Ministry.

**3. Ministry designation and referral (§3.1(f), §3.3).**
Nothing lets the Ministry designate an event into the process, record a referral from
another authority, or make the final determination when applicability is uncertain.
· **Options:** add the capability to the console — or handle designations outside the
platform and record the result as an ordinary event.
· **Standing behaviour:** absent. An uncertain organizer has no route.
· **Answer:** Ministry.

**4. Level 1's responsible contact.**
The Protocol wants a responsible organizer contact on every event; at Level 1 there is
no form that could carry one (no compliance form, collapsed plan, no contact field).
· **Options:** add the field to the assessment — or accept the account holder as the
contact of record.
· **Standing behaviour:** the account holder, implicitly.
· **Answer:** Ministry.

## B. The filing timeline

**5. Cancellation and postponement.**
Three instruments require the organizer to notify these; the platform has no route for
either.
· **Options:** a distinct notice with its own state — or a material-change aspect.
Either way: what happens to the reference number, and does the Ministry's determination
survive?
· **Standing behaviour:** unbuilt. Neither word appears in the platform.
· **Answer:** Ministry, then build.

**6. What a material change does to a filed submission.**
A reported change that could raise the level currently changes nothing automatically.
· **Options:** reopen the assessment, void the determination, or leave it to the
reviewer's judgment on the change notice.
· **Standing behaviour:** inert by design caution — the change reaches the Ministry and
waits for a person.
· **Answer:** Ministry.

**7. Capturing the external authorization.**
Both limbs of the Level 1 deadline turn on whether an external authorization is
required, and §4 expects the reference to be quoted to the authorizing authority — but
nothing records whether or when one was issued.
· **Options:** capture it (making both limbs evaluable and the §4 loop visible) — or
leave the condition as stated prose the organizer applies themselves.
· **Standing behaviour:** prose. The 7-day date is computed for every Level 1 event
regardless of which limb applies.
· **Answer:** Ministry.

**8. The interim filing channel (§9 ¶3).**
The Protocol allows a designated email address until the portal is operational.
· **Options:** record formally that the portal supersedes it — or publish a fallback.
· **Standing behaviour:** no fallback exists.
· **Answer:** Ministry (likely a formality).

## C. Signatures and evidence

**9. What a signature is.** *(One answer settles six surfaces.)*
Six places capture a certification with no signature control: the assessment
declaration, the organizer's compliance certification, the post-event report, the
facility response plan's confirmation, the device registration confirmation, and the
facility incident report.
· **Options:** a typed name as signature · a credentialed act (the signed-in account,
timestamped) · a drawn or uploaded signature · the filing act itself.
· **Standing behaviour:** mixed — some surfaces record the act and its timestamp, some
capture a representative's name, none captures a signature as such.
· **Answer:** Ministry (legal weight) · **Then:** build once, apply to all six.

**10. Insurance evidence.**
The Level 3 insurance declaration takes insurer, policy number, coverage period and
"evidence attached" as four free-text boxes; no document is required and nothing is
validated. *(The Arabic issue of the compliance form omits this declaration entirely —
divergence 1.)*
· **Options:** a required attachment with its own row in the package — or free text as
today.
· **Standing behaviour:** free text.
· **Answer:** Ministry.

**11. The Event Medical Director's licensure.**
"A licensed physician" is asserted by the nomination and never captured or checked.
· **Options:** capture a licence number at acceptance · verify through the Order of
Physicians lane (built, off by default, non-determinative) · continue to assert.
· **Standing behaviour:** asserted.
· **Answer:** Ministry.

**12. Document storage.**
The platform records the name of the document you attach; the file itself is not stored
(no storage location has been chosen).
· **Options:** object storage inside the Ministry's estate · a document-management
integration · continue to record names and receive documents another way.
· **Standing behaviour:** name only. The screens say a document is attached.
· **Answer:** Ministry data-residency answer · **Then:** platform.

## D. Who uses the platform

**13. The role model.**
Five gaps in one question: no organization-administrator role (one account owns
everything), no distinct site or cardiac-readiness coordinator, no multi-role accounts,
EMS providers cannot file first-response reports, and first-response units are
standalone accounts rather than parties an organizer nominates.
· **Options:** model the roles the product specification names — or keep the narrower
set the regulation strictly requires.
· **Standing behaviour:** the narrower set.
· **Answer:** Ministry + product.

**14. The medical provider's own surface.**
The requirements matrix assigns patient-care documentation to the *medical provider* —
a party with no account class in the platform.
· **Options:** give them a surface — or keep it a line the organizer certifies to.
· **Standing behaviour:** an organizer certification.
· **Answer:** Ministry.

**15. The platform owner's reach.**
The product specification describes platform-wide visibility across every organization
and record; the summaries say counts only.
· **Options:** the narrow reading (aggregate counts, nothing named) — or full tenant
visibility with an audit trail.
· **Standing behaviour:** counts only, demonstration rows excluded, nothing filterable
to one organization. The screen states the limit.
· **Answer:** Ministry (a privacy question) · **Note:** the surface is already built
either way.

## E. Data out

**16. Aggregate publication, surveillance and quality improvement.**
The Protocol permits publishing aggregated national findings and using post-event data
for surveillance, quality improvement and future scoring. None of it exists: no
publication surface, no audit trail, no export, and post-event data feeds nothing.
· **Options:** define the outputs, the de-identification rule and whether post-event
data revises future assessments — or defer the whole analytics phase.
· **Standing behaviour:** reports are listed and counted; nothing is published or fed
back.
· **Answer:** Ministry · **Note:** sequences with the AI layer, which is deliberately
not built.

**17. How the public lookup resists enumeration.**
Reference numbers are sequential and the lookup is unauthenticated, so the two together
would let anyone walk the national register. Today: the event start date as a second
factor, plus a rate limit held in one server's memory.
· **Options:** keep the date second factor · issue a separate non-sequential public
token · a shared rate-limit store that survives restart and scale-out.
· **Standing behaviour:** date + per-process limit. The limit does not survive a
restart, and an event's dates are often public.
· **Answer:** Ministry, with platform advice.

**18. How deep facility readiness is captured.**
Two of the nine facility requirements are self-attested checkboxes: CPR/AED-trained
personnel available during operating hours, and AED accessibility.
· **Options:** capture personnel records, training validity dates and the policy's
accessibility test — or accept the operator's attestation.
· **Standing behaviour:** attestation.
· **Answer:** Ministry.

---

## Sequencing note

Three of these block other work rather than merely waiting: **9 (signatures)** unblocks
six surfaces at once, **5 (cancellation)** is a live regulatory obligation with no route
today, and **12 (document storage)** decides whether the platform ever holds a file.
The rest can be answered in any order.

Nine of the eighteen need only a Ministry sentence; the platform changes are small once
the sentence exists.

19. **The attestation lane fallback** — items assigned to the Order of Physicians while its
lane is off (the default): the build lets the Ministry record them itself, because a pending
item nobody may record makes "satisfied" permanently unreachable at Level 3. The
alternatives — items not in force while the lane is off, or blocking with no recorder — each
contradict either the gate or the lane's own screen. The prototype holds both sides of the
contradiction (Order items read-only to the Ministry; the lane off on its own Order screen).
Who records Order-assigned attestations while the lane is off. *Ministry.*
