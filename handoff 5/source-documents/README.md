# Source documents — the regulation itself

Seventeen files. The actual regulatory instruments in English and Arabic, as issued.

**These outrank every other document in the pack.** `SPEC.md`, `ROADMAP.md` and `CLAUDE-CODE-START-HERE.md` are a summary of these, written to be buildable. Where a summary and a source disagree, the source wins and the summary is wrong.

That is not a formality. The summary has already been wrong twice in ways that mattered:

- It said nine minimum conditions. There are ten.
- It named two conditions as non-derivable. There are seven, and one of the two that does derive over-fires.

Both were found by going to the data rather than trusting the prose. Assume more of the same.

## What is in each

### English — `en/`

| File | What it is | Why it matters |
|---|---|---|
| `01 National Protocol.docx` | The governing instrument | Applicability §3, roles §7, lead times §8, material change §8.5, outcomes §10, the sixteen plan items §6, the eleven major-incident items §12, notification and reporting §13, data §14 |
| `02 Annex A — NEHRAT risk assessment tool.docx` | The assessment | Part A event information, Part B nine domains with every option and score, Part C bands, **Part D the ten minimum conditions**, Part E higher-of, Part F certification |
| `03 Annexes B and C.docx` | Requirements matrix and compliance form | All twenty requirements with responsible party and value at each level; Annex C section A eight declarations, section B the ten first-responder items, both certification blocks |
| `04 Annex D — post-event medical report.docx` | The post-event report | Every field, the eight significant-event checkboxes, and **two signature blocks** — organizer, and Event Medical Director at Level 3 |
| `05 Guidance — preparing event health and medical plans.docx` | Non-binding guidance | The core principle, the eight-step planning workflow, depth by level. Creates no requirements — say so wherever it is surfaced |
| `06 Cardiac-arrest readiness and PAD policy.docx` | The second instrument | Facility categories §3, the nine readiness requirements §4, the response plan, the registration dataset, the facility incident report, Ministry configuration §11, the relationship between the two instruments §12, data minimisation §13 |
| `07 Product specification.docx` | The platform specification | The user classes, the eight-step sequence, record identifier vs Ministry reference, nomination rules, the Order of Physicians lane §9.6, feature flags, roles, registry, master admin |

### Arabic — `ar/`

The Arabic issue of the same instruments. `02` NEHRAT, `03` the requirements matrix and the compliance form, `04` the post-event report, `06` the five PAD annexes A–E.

**Arabic is not a translation to be regenerated.** It is the Arabic issue of the regulation, and its wording is the wording. Take every Arabic string from here where one exists rather than translating the English.

## Known divergences between the two issues

Found by reading both. **Do not silently pick one.** Each needs a Ministry decision, and until then follow the English and record the divergence.

1. **Arabic Annex C omits the insurance declaration entirely.** English section A has eight items including insurance coverage with insurer, policy number, coverage period and evidence attached. Arabic has seven and no insurance item.
2. **Arabic Annex C omits Telephone** from both certification blocks. English has it in the organizer's and the provider's.
3. **Requirement 7** — English *Ambulance arrangements*; Arabic *ترتيبات سيارات الإسعاف والنقل*, "ambulance **and transport** arrangements".
4. **Requirement 13** — English *Participating EMS agency notified*; Arabic adds *والتنسيق معها*, "**and coordinated with**". A stronger obligation.
5. **Requirement 15** — English *Event Medical command function*; Arabic *وظيفة محددة للقيادة الطبية*, "a **defined** medical command function".
6. **Annex C first-responder item 10** — English *reviewed and confirmed its role*; Arabic adds *وأكدت جاهزيتها لتنفيذه*, "and confirmed its readiness to perform it".
7. **The responsibility sentence** — Annex B's own list omits *patient care*, which Protocol §7 includes. The build uses §7's fuller list.
8. **Level 1 and the compliance form** — Protocol §8.1 says Annex C and a full plan are *not routinely required* at Level 1; Annex C's own header says a Level 1 organizer completes it *only when requested*. The build follows Annex C.

## Things in the sources that no summary carries

Present in the regulation, absent or thin in the design and in the summary documents. Flag before building the affected screen; do not invent.

- **Protocol §6 — the sixteen items an event health and medical plan must address.** The design has the plan as sixteen sections; the authoritative wording is here.
- **Protocol §12 — the eleven items a major-incident and mass-casualty plan must identify.**
- **PAD Annex E — first-response readiness.** Minimum equipment, personnel competence, operational readiness, the written procedure.
- **The national minimum cardiac-arrest reporting dataset**, five sections, in the PAD annexes.
- **Annex D's Event Medical Director signature block.** Two signatures at Level 3, not one.
- **Protocol §8.1 second limb** — the seven-day lead time where no external authorization is required. The reason Level 1 has a conditional deadline rather than none.
- **The Guidance's eight-step planning workflow and depth-by-level table.**

## How to use these

Read the English set once, in the order numbered. Then, for each screen you build, read the section of the source that governs it before writing the copy — not the summary of it.

When a source contradicts a summary document, say so in the handback rather than reconciling it silently. The summaries are mine and they are wrong in places; the regulation is not.
