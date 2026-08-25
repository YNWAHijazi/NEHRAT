#!/usr/bin/env python3
"""
Extract the regulatory reference data from the design prototypes.

The nine assessment domains and the ten minimum conditions exist ONLY in
`handoff 5/pages/Organizer Journey.dc.html`. No markdown document enumerates them.
This script is the single supported way to refresh them.

It emits `lib/reference/reference-snapshot.json`, which records:
  - the domains and their 0/1/2 options, English and Arabic
  - the minimum conditions, their keys, levels and both languages
  - the prototype's own `derived:` expression for each condition, as provenance
  - a SHA-256 of the source file

The drift test compares the build's `lib/rules/data/*.json` against this snapshot AND
checks the SHA. If the reference HTML changes, the SHA no longer matches and the test
fails telling you to re-run this script. That is how reference drift gets caught rather
than discovered.

Usage:  npm run rules:regenerate
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from jsparse import extract
import re
import zipfile
from xml.etree import ElementTree as ET

PLATFORM = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).parent))
from pack import pack_dir
REFERENCE = pack_dir(PLATFORM) / "pages" / "Organizer Journey.dc.html"
ARABIC_NEHRAT = pack_dir(PLATFORM) / "source-documents" / "ar" / "02 NEHRAT.docx"
OUT = PLATFORM / "lib" / "reference" / "reference-snapshot.json"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_text(path):
    """Paragraphs and table rows of a .docx, in document order."""
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read("word/document.xml"))
    out = []
    for el in root.find(f"{W}body"):
        if el.tag == f"{W}p":
            text = "".join(t.text or "" for t in el.iter(f"{W}t")).strip()
            if text:
                out.append(text)
        elif el.tag == f"{W}tbl":
            for tr in el.findall(f"{W}tr"):
                cells = []
                for tc in tr.findall(f"{W}tc"):
                    cell = " / ".join(
                        "".join(t.text or "" for t in p.iter(f"{W}t")).strip()
                        for p in tc.iter(f"{W}p")
                        if "".join(t.text or "" for t in p.iter(f"{W}t")).strip()
                    )
                    cells.append(cell)
                out.append("| " + " | ".join(cells))
    return "\n".join(out)


def parse_arabic_nehrat(path):
    """The Arabic issue's domain names, option texts and Part D rows.

    Decision (handoff 5, item 3): where the prototype's Arabic conflicts with the
    Arabic issue, the issue wins. This parser is the authority for those strings.
    """
    text = docx_text(path)
    # Domains: numbered headings 1..9 followed by score rows.
    blocks = re.split(r"\n(?=[1-9]\.\s)", text)
    domains = []
    for b in blocks:
        m = re.match(r"([1-9])\.\s+([^\n]+)", b)
        if not m:
            continue
        n = int(m.group(1))
        if n != len(domains) + 1:
            continue
        name = m.group(2).strip()
        opts = dict(
            (int(s), o.strip())
            for s, o in re.findall(r"\| ([0-2]) \| ([^\n|]+)", b)
        )
        if len(opts) == 3:
            domains.append({"ar": name, "options": opts})
    if len(domains) != 9:
        raise SystemExit(f"Arabic NEHRAT parse found {len(domains)} domains, expected 9")

    # Part D rows, in order; mapped to condition keys by position/level.
    part_d = text.split("الجزء د")[1].split("الجزء هـ")[0]
    rows = re.findall(r"\| ([^|\n]+) \| (المستوى [23])", part_d)
    rows = [(c.strip(), l) for c, l in rows if "الحد الأدنى" not in c]
    if len(rows) != 9:
        raise SystemExit(f"Arabic Part D parse found {len(rows)} rows, expected 9")
    ar_condition_order = ["att2", "att3", "recur", "run", "run21", "tri", "open", "combat", "motor"]
    conditions = dict(zip(ar_condition_order, (c for c, _ in rows)))
    return domains, conditions


def main() -> int:
    if not REFERENCE.exists():
        print(f"Reference file not found: {REFERENCE}", file=sys.stderr)
        return 1

    raw = REFERENCE.read_bytes()
    src = raw.decode("utf-8")

    domain_defs = extract(src, "domainDefs")
    min_defs = extract(src, "minDefs")

    if len(domain_defs) != 9:
        print(f"Expected 9 domains, found {len(domain_defs)}", file=sys.stderr)
        return 1
    if len(min_defs) != 10:
        print(f"Expected 10 minimum conditions, found {len(min_defs)}", file=sys.stderr)
        return 1

    ar_domains, ar_conditions = parse_arabic_nehrat(ARABIC_NEHRAT)

    # Which issue of Annex A carries each of the ten union rows (handoff 5, decision 1).
    ISSUE = {
        "att2": "both", "att3": "both", "club": "en-only", "recur": "ar-only",
        "run": "both", "run21": "both", "tri": "both", "open": "both",
        "combat": "both", "motor": "both",
    }

    domains = []
    for i, d in enumerate(domain_defs, start=1):
        opts = d["opts"]
        if len(opts) != 3:
            print(f"Domain {i} has {len(opts)} options, expected 3", file=sys.stderr)
            return 1
        issue = ar_domains[i - 1]
        domains.append(
            {
                "number": i,
                "en": d["en"],
                # The Arabic issue's wording, not the prototype's translation.
                "ar": issue["ar"],
                "prototypeAr": d["ar"],
                "noteEn": d.get("noteEn", ""),
                "noteAr": d.get("noteAr", ""),
                "options": [
                    {"score": score, "en": o[0], "ar": issue["options"][score], "prototypeAr": o[1]}
                    for score, o in enumerate(opts)
                ],
            }
        )

    conditions = []
    for m in min_defs:
        key = m["k"]
        derived = m.get("derived")
        ar_issue_text = ar_conditions.get(key)
        conditions.append(
            {
                "key": key,
                "level": m["level"],
                "en": m["en"],
                # The Arabic issue's wording where it carries the row; the prototype's
                # translation only where the row is English-only (club), tagged as such.
                "ar": ar_issue_text if ar_issue_text else m["ar"],
                "prototypeAr": m["ar"],
                # Which issue of Annex A carries this row. The ten are a union: a
                # reconciliation, not the regulation (SPEC 1), pending the Ministry.
                "issue": ISSUE[key],
                "arabicIsTranslation": ar_issue_text is None,
                # Provenance only. `false` means the prototype used a manual checkbox;
                # a string is the JS expression it derived from. Neither is what the
                # build does -- see lib/rules/data/minimum-conditions.json.
                "prototypeDerivedFrom": False if derived is False else str(derived),
            }
        )

    snapshot = {
        "$comment": (
            "GENERATED by scripts/extract-reference.py -- do not edit by hand. "
            "Re-run `npm run rules:regenerate` when the reference prototype or the "
            "Arabic NEHRAT changes. Arabic assessment strings come from the Arabic "
            "issue (handoff 5, decision 3); prototypeAr records what the prototype "
            "carries so its re-issue can be tracked."
        ),
        "sourceFile": str(REFERENCE.relative_to(PLATFORM.parent)),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "arabicSourceFile": str(ARABIC_NEHRAT.relative_to(PLATFORM.parent)),
        "arabicSourceSha256": hashlib.sha256(ARABIC_NEHRAT.read_bytes()).hexdigest(),
        # Arabic-issue deltas the English lacks, carried as source-tagged notes rather
        # than folded in silently (handoff 5, decision 1).
        "arabicOnlyNotes": [
            {
                "where": "domain 2, score 0",
                "ar": "يضيف الإصدار العربي: أو خدمة دينية يحضرها الجمهور جلوساً",
                "en": "The Arabic issue adds: or a religious service attended by a seated public.",
                "source": "ar/02 NEHRAT, Part B, domain 2",
            },
            {
                "where": "domain 6, score 2",
                "ar": "يشترط الإصدار العربي أن يكون التحذير صادراً عن سلطة عامة مختصة",
                "en": "The Arabic issue requires the warning be issued by a competent public authority.",
                "source": "ar/02 NEHRAT, Part B, domain 6",
            },
            {
                "where": "recurring venues",
                "ar": "يضيف الإصدار العربي: يُحدَّد في التقييم السنوي تاريخ بدء سريانه وتاريخ انتهاء صلاحيته",
                "en": "The Arabic issue adds: the annual assessment carries an effective date and an expiry date.",
                "source": "ar/02 NEHRAT, Part D, recurring venues",
            },
        ],
        "domains": domains,
        "minimumConditions": conditions,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    manual = [c["key"] for c in conditions if c["prototypeDerivedFrom"] is False]
    ar_diffs = sum(
        1 for d in domains for o in d["options"] if o["ar"] != o["prototypeAr"]
    ) + sum(1 for d in domains if d["ar"] != d["prototypeAr"])
    print(f"Wrote {OUT.relative_to(PLATFORM)}")
    print(f"  {len(domains)} domains, {len(conditions)} minimum conditions")
    print(f"  source sha256: {snapshot['sourceSha256'][:16]}...")
    print(f"  arabic issue sha256: {snapshot['arabicSourceSha256'][:16]}...")
    print(f"  manual in the prototype (must be derived in the build): {', '.join(manual)}")
    print(f"  prototype Arabic strings still diverging from the Arabic issue: {ar_diffs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
