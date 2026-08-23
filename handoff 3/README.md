# Event Health Readiness Platform — design handoff

Six reference designs for a Ministry of Public Health regulatory platform (Lebanon), and the four documents that make them buildable.

## Read in this order

1. **[CLAUDE-CODE-START-HERE.md](CLAUDE-CODE-START-HERE.md)** — the brief. Non-negotiables, build order, and what to do before writing any code. Start here.
2. **[SPEC.md](SPEC.md)** — the regulatory rules and the glossary. Not visible in the markup, and they are the product.
3. **[ROADMAP.md](ROADMAP.md)** — every screen, its route, and every place it is reached from. **Authoritative on routing.**
4. **[tokens.css](tokens.css)** — palette, fonts, geometry, RTL rules. Adopt verbatim.

`ROUTES.md`, `PROMPTS.md` and `ORGANIZER-ROUTES.md` were written for an earlier build and contradicted the three above. They are removed. If you are holding an older copy of this pack, delete them.

**The derivation data is only in the HTML.** The nine domains with their options and the ten minimum conditions live in `pages/Organizer Journey.dc.html`, in the logic class, not in any markdown file. Extract them from there.

## The six pages

| File | Who it is for |
|---|---|
| `pages/Event Health Readiness.dc.html` | Public landing — applicability, services, reference lookup |
| `pages/Organizer Journey.dc.html` | Event organizer — assessment, requirements, medical plan, submission, post-event report |
| `pages/EMS Agency.dc.html` | Participating emergency medical service — nomination, participation, readiness declaration |
| `pages/Medical Director.dc.html` | Event Medical Director — Level 3 only |
| `pages/Ministry Review.dc.html` | Ministry reviewers, inspectors, administrators, platform owner |

## How to read a page

Open it in a browser. Every page works: the tab strip reaches any screen, and the dock on the right toggles language, dark mode, palette and text size. **Try the Arabic toggle** — full layout mirroring is a requirement, not a nicety.

One thing to understand before building: **the tab strip is a design index, not product navigation.** It exists so a reviewer can reach any screen. `ROUTES.md` says which tabs are real routes and which are design-only.

In the source, each file has three parts:

- `<x-dc>…</x-dc>` — the markup. All styling is inline; no CSS classes to chase.
- `<script data-dc-script>class Component…</script>` — state and data. Every list, label and state machine is here.
- `<helmet><style>` at the top — palette tokens, fonts, RTL rules, breakpoints.

`<sc-if>` and `<sc-for>` are conditionals and loops. `{{ name }}` is a value from `renderVals()`.

`pages/support.js` is the runtime that renders these files. It is not part of the design and should not be ported.

## Scope

These are reference designs, not a codebase to extend. Rebuild them in your own stack. Carry across the layout, the wording, the state machines and the bilingual treatment — and above all the rules in `SPEC.md`, which no screenshot conveys.
