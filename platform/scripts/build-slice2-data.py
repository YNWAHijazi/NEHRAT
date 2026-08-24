#!/usr/bin/env python3
"""
Generates the Slice 2 regulatory data files in lib/rules/data/ from the reference
prototype (structure, English, level logic) and the Arabic issues of the annexes
(Arabic wording -- handoff 5, decision 3: where an Arabic issue exists, its wording
wins over the prototype's translation).

Emits:
  requirements-matrix.json   Annex B: 20 rows, per-level values, computed parties
  attachments-catalog.json   the submitted documents, by level
  compliance-form.json       Annex C: header, section A, attachments, certifications, section B
  plan.json                  Protocol 6: the 16 mandatory items; 12: the 11 MI items;
                             the Guidance's 14-section template (non-binding)
  material-change.json       Protocol 8.5: the enumerated aspects
  post-event-report.json     Annex D: fields, significant events, signatures

Known EN/AR divergences ride as `divergence` tags on the affected rows; rows one issue
lacks are tagged `arabicIsTranslation` or `issue`. Nothing is silently reconciled.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent))
from jsparse import P

PLATFORM = Path(__file__).resolve().parent.parent
HANDOFF = PLATFORM.parent / "handoff 5"
PAGE = HANDOFF / "pages" / "Organizer Journey.dc.html"
AR = HANDOFF / "source-documents" / "ar"
DATA = PLATFORM / "lib" / "rules" / "data"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_lines(path: Path) -> list[str]:
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
    return out


def extract_array(src: str, name: str, neuter: bool = False):
    m = re.search(rf"{name}\s*[:=]\s*\[", src)
    if not m:
        raise SystemExit(f"array {name} not found in prototype")
    b = src.index("[", m.start())
    if not neuter:
        return P(src[b:]).val()
    depth = 0
    i = b
    while True:
        c = src[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        elif c in "\"'":
            q = c
            i += 1
            while src[i] != q:
                i += 2 if src[i] == "\\" else 1
        i += 1
    text = re.sub(r"'\s*\+\s*[\w.\[\]]+(\s*\+\s*')?", "' ", src[b : i + 1])
    return P(text).val()


def write(name: str, payload: dict) -> None:
    path = DATA / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(PLATFORM)}")


def main() -> int:
    src = PAGE.read_text(encoding="utf-8")

    # ---------- Annex B: the requirements matrix ----------
    matrix = extract_array(src, "const matrix")
    ar_rows = [
        l for l in docx_lines(AR / "03 requirements matrix.docx")
        if l.startswith("| ") and l.count("|") == 5 and "المتطلب" not in l
    ]
    assert len(matrix) == 20 and len(ar_rows) == 20, (len(matrix), len(ar_rows))
    DIVERGENCE = {
        7: "Arabic adds transport: ترتيبات سيارات الإسعاف والنقل (README divergence 3).",
        13: "Arabic adds coordination: والتنسيق معها -- a stronger obligation (README divergence 4).",
        15: "Arabic requires a DEFINED command function: وظيفة محددة للقيادة الطبية (README divergence 5).",
    }
    rows = []
    for m, ar_line in zip(matrix, ar_rows):
        cells = [c.strip() for c in ar_line.strip("| ").split(" | ")]
        # The copy rule bans naming an annex to users; the prototype's English already
        # strips the parenthetical and the display Arabic follows it. The issue's
        # verbatim wording is preserved as arSource.
        ar_display = re.sub(r"\s*\(الملحق [^)]+\)", "", cells[0])
        row = {
            "n": m["n"],
            "en": m["en"],
            "ar": ar_display,
            **({"arSource": cells[0]} if ar_display != cells[0] else {}),
            "prototypeAr": m["ar"],
            "parties": m["p"],
            "attach": bool(m.get("attach")),
            "ems": bool(m.get("ems")),
            "inspection": bool(m.get("inspect")),
            "values": [
                {"en": v[0], "ar": cells[2 + i]} if v else None
                for i, v in enumerate(m["v"])
            ],
        }
        if m["n"] in DIVERGENCE:
            row["divergence"] = DIVERGENCE[m["n"]]
        rows.append(row)
    write("requirements-matrix.json", {
        "$comment": (
            "Annex B, the twenty minimum requirements. English and structure from the "
            "reference prototype; Arabic row names and cell values verbatim from the "
            "Arabic issue (ar/03 requirements matrix). Rows 7, 13 and 15 carry known "
            "EN/AR divergences -- follow the English, record the divergence (README). "
            "Responsible parties are COMPUTED from `parties` per level, never hard-coded."
        ),
        "parties": {
            "O": {"en": "Organizer", "ar": "المنظِّم"},
            "E": {"en": "Participating EMS provider", "ar": "مزوّد الإسعاف المشارك"},
            "M": {"en": "Medical provider", "ar": "المزوّد الطبي"},
            "D": {"en": "Event Medical Director", "ar": "المدير الطبي للفعالية"},
        },
        "requirements": rows,
    })

    # ---------- The attachments catalog ----------
    # Names: the compliance form's official attachment list where it names one; the
    # plan under its official Arabic name (SPEC 2b), not the prototype's translation.
    write("attachments-catalog.json", {
        "$comment": (
            "The submitted documents by level, from the prototype's catalog with Arabic "
            "aligned to the compliance form's attachment list. The plan carries its "
            "official Arabic name (SPEC 2b). State lives in the database; this is the catalog."
        ),
        "documents": [
            {"key": "assessment", "en": "Risk assessment", "ar": "تقييم المخاطر",
             "minLevel": 1, "system": True,
             "noteEn": "Generated from your assessment", "noteAr": "يُنشأ من تقييمكم"},
            {"key": "arrangements", "en": "Documented medical arrangements", "ar": "ترتيبات طبية موثّقة",
             "minLevel": 1, "maxLevel": 1, "attach": True},
            {"key": "complianceForm", "en": "Compliance and submission form", "ar": "نموذج الامتثال والتقديم",
             "minLevel": 2, "platform": True},
            {"key": "plan", "en": "Event health and medical plan", "ar": "خطة التأهب الصحي والطبي للفعالية",
             "minLevel": 2, "platform": True},
            {"key": "siteMap", "en": "Event site or route map", "ar": "خريطة موقع الفعالية أو مسارها",
             "minLevel": 2, "attach": True},
            {"key": "deploymentMap", "en": "Medical deployment map", "ar": "خريطة الانتشار الطبي",
             "minLevel": 3, "attach": True},
            {"key": "emsDeclarations",
             "en": "EMS readiness declaration from each participating EMS provider",
             "ar": "إقرار جاهزية الإسعاف من كل مزوّد إسعاف مشارك",
             "minLevel": 3, "thirdParty": True},
            {"key": "other", "en": "Other", "ar": "غير ذلك", "minLevel": 2, "attach": True, "optional": True},
        ],
    })

    # ---------- Annex C: the compliance and submission form ----------
    decl = extract_array(src, "annexCDecl", neuter=True)
    ar_c = docx_lines(AR / "03 compliance and submission form.docx")
    # Official Arabic A-items (seven -- no insurance) in order.
    ar_a_items = [l.lstrip("☐").strip() for l in ar_c if l.startswith("☐")][:7]
    # Official Arabic B-items: the ten, between the section B heading and the agency certification.
    b_start = next(i for i, l in enumerate(ar_c) if "ب. إقرار جاهزية" in l)
    ar_b_items = [l.lstrip("☐").strip() for l in ar_c[b_start:] if l.startswith("☐")][:10]
    assert len(ar_b_items) == 10, len(ar_b_items)

    # Map the prototype's eight A-items onto the official seven + insurance (EN-only).
    a_items = []
    ar_iter = iter(ar_a_items)
    for item in decl:
        entry = {"en": item["en"], "minLevel": item.get("min", 1)}
        if "insurance" in item["en"].lower():
            entry["ar"] = item["ar"]
            entry["arabicIsTranslation"] = True
            entry["divergence"] = (
                "Arabic Annex C omits the insurance declaration entirely (README divergence 1). "
                "Follow the English; the Arabic here is a translation pending the Ministry."
            )
            entry["fields"] = [
                {"key": "insurer", "en": "Insurer", "ar": "شركة التأمين"},
                {"key": "policyNumber", "en": "Policy / certificate number", "ar": "رقم البوليصة أو الشهادة"},
                {"key": "coveragePeriod", "en": "Coverage period", "ar": "فترة التغطية"},
                {"key": "evidenceAttached", "en": "Evidence of insurance attached", "ar": "أُرفق إثبات التأمين"},
            ]
            entry["minLevel"] = 3
        else:
            entry["ar"] = next(ar_iter)
        if item.get("blocked"):
            entry["blockedBy"] = "unansweredProviders" if "allConf" in str(item["blocked"]) else str(item["blocked"])
        a_items.append(entry)

    write("compliance-form.json", {
        "$comment": (
            "Annex C. English from the reference prototype (which renders the ban-compliant "
            "wording); Arabic verbatim from the Arabic issue where it carries the item. The "
            "insurance declaration and the Telephone field are English-only -- known "
            "divergences 1 and 2; follow the English and record it."
        ),
        "header": [
            {"key": "eventName", "en": "Event name", "ar": "اسم الفعالية"},
            {"key": "organizer", "en": "Organizer", "ar": "المنظم"},
            {"key": "dates", "en": "Date(s)", "ar": "تاريخ الفعالية أو تواريخها"},
            {"key": "venueRoute", "en": "Venue / Route", "ar": "الموقع أو المسار"},
            {"key": "finalLevel", "en": "Final level", "ar": "المستوى النهائي وفق أداة NEHRAT"},
            {"key": "submissionDate", "en": "Submission date", "ar": "تاريخ التقديم"},
            {"key": "mophReference", "en": "Ministry reference number", "ar": "الرقم المرجعي لوزارة الصحة العامة"},
            {"key": "planVersion", "en": "Version of the event health and medical plan", "ar": "رقم إصدار خطة التأهب الصحي والطبي للفعالية"},
        ],
        "sectionA": a_items,
        "organizerCertification": {
            "statementEn": "I certify that this submission is complete and accurate and that the organizer will comply with the applicable requirements.",
            "statementAr": "أقر بأن المعلومات الواردة في هذا التقديم كاملة ودقيقة، وأن المنظم سيلتزم بجميع المتطلبات المنطبقة.",
            "fields": [
                {"key": "representative", "en": "Authorized representative", "ar": "الممثل المفوض"},
                {"key": "telephone", "en": "Telephone", "ar": "الهاتف", "arabicIsTranslation": True,
                 "divergence": "Arabic Annex C omits Telephone from both certification blocks (README divergence 2)."},
                {"key": "position", "en": "Position", "ar": "الصفة"},
            ],
        },
        "sectionB": {
            "$comment": "The Level 3 EMS Readiness Declaration: ten items, signed separately by each participating agency. Arabic verbatim from the Arabic issue. Rendered on the EMS provider's surface (Slice 5); the organizer sees state only.",
            "items": [
                {"en": en, "ar": ar}
                for en, ar in zip([
                    "EMS agency and operational lead identified.",
                    "Assigned personnel and BLS response teams documented.",
                    "Assigned ambulances documented and ready for service.",
                    "CPR capability, AEDs, oxygen, airway equipment, communications, and response procedures verified.",
                    "Ambulance deployment points and patient-extraction routes confirmed.",
                    "Receiving emergency department(s) confirmed.",
                    "Communication with the Event Medical Director established.",
                    "Procedure for requesting additional EMS resources established.",
                    "Procedure for maintaining event coverage during patient transport established.",
                    "The agency has reviewed and confirmed its role in the major-incident / mass-casualty response plan.",
                ], ar_b_items)
            ],
            "item10Divergence": "Arabic adds: وأكدت جاهزيتها لتنفيذه -- confirmed its readiness to perform it (README divergence 6).",
        },
    })

    # ---------- The plan: 16 mandatory items, 11 MI items, the non-binding template ----------
    plan_defs = extract_array(src, "const planDefs")
    mi_defs = extract_array(src, "const miDefs")
    assert len(plan_defs) == 16 and len(mi_defs) == 11
    write("plan.json", {
        "$comment": (
            "The event health and medical plan (خطة التأهب الصحي والطبي للفعالية, SPEC 2b). "
            "The sixteen items are Protocol 6 -- the mandatory checklist, quoted from the "
            "prototype which carries the regulation's wording. The eleven items are Protocol "
            "12. The fourteen-section template is the GUIDANCE's recommended structure: "
            "non-binding, creates no requirements, offered as structure only. The Guidance "
            "has no Arabic issue; the template's Arabic is ours and marked so."
        ),
        "sections": [
            {"n": i + 1, "en": d[0], "ar": d[1], "bodyEn": d[2], "bodyAr": d[3],
             **({"summaryEn": d[4]} if len(d) > 4 else {})}
            for i, d in enumerate(plan_defs)
        ],
        "majorIncidentItems": [
            {"n": i + 1, "en": d[0], "ar": d[1]} for i, d in enumerate(mi_defs)
        ],
        "guidanceTemplate": {
            "nonBindingEn": "The fourteen-section structure below is from the Ministry's guidance. It is non-binding implementation guidance and creates no requirements; the sixteen items above are what the plan must address.",
            "nonBindingAr": "الهيكل المكوّن من أربعة عشر قسماً أدناه مأخوذ من إرشادات الوزارة. وهو إرشاد تنفيذي غير ملزم ولا يُنشئ أي متطلبات؛ والبنود الستة عشر أعلاه هي ما يجب أن تعالجه الخطة.",
            "arabicIsTranslation": True,
            "sections": [
                {"n": n, "en": en, "ar": ar} for n, (en, ar) in enumerate([
                    ("Document control", "ضبط المستند"),
                    ("Event profile", "موجز الفعالية"),
                    ("Risk summary", "ملخص المخاطر"),
                    ("Accountability, provider contacts, and Level 3 medical direction", "المسؤولية وجهات اتصال المزوّدين والإدارة الطبية للمستوى 3"),
                    ("Staffing and deployment", "الكوادر والانتشار"),
                    ("Treatment post(s)", "نقاط العلاج"),
                    ("CPR and AED response", "الاستجابة بالإنعاش القلبي الرئوي وأجهزة AED"),
                    ("Patient access/extraction", "الوصول إلى المرضى وإخلاؤهم"),
                    ("Ambulance and hospital plan", "خطة الإسعاف والمستشفيات"),
                    ("Coordination and communications; medical command for Level 3", "التنسيق والاتصالات؛ والقيادة الطبية للمستوى 3"),
                    ("Major incident/MCI plan", "خطة الحوادث الجسيمة والإصابات الجماعية"),
                    ("Contingencies", "الطوارئ والاحتمالات"),
                    ("Patient records and reporting", "سجلات المرضى والإبلاغ"),
                    ("Maps and directories", "الخرائط والأدلة"),
                ], start=1)
            ],
        },
    })

    # ---------- Material change: the enumerated aspects ----------
    aspects = extract_array(src, "const aspectDefs")
    write("material-change.json", {
        "$comment": (
            "Protocol 8.5's enumerated material-change aspects, from the prototype. The "
            "Protocol has no Arabic issue in the pack; the prototype's Arabic stands."
        ),
        "aspects": [
            {"key": a["k"], "en": a["en"], "ar": a["ar"],
             "affectsEn": a.get("affEn", ""), "affectsAr": a.get("affAr", ""),
             "consequenceEn": a.get("conEn", ""), "consequenceAr": a.get("conAr", ""),
             "levelMayChange": bool(a.get("lvl"))}
            for a in aspects if a.get("en")
        ],
    })

    # ---------- Annex D: the post-event medical report ----------
    write("post-event-report.json", {
        "$comment": (
            "Annex D. English from the English issue, Arabic verbatim from the Arabic issue "
            "(ar/04). Aggregate data only -- no unnecessary personally identifiable medical "
            "information (Protocol 14); the free-text field is name-screened. Two signatures "
            "at Level 3."
        ),
        "activityFields": [
            {"key": "estimatedAttendance", "en": "Estimated attendance", "ar": "الحضور التقديري للفعالية"},
            {"key": "patientsTreated", "en": "Patients assessed or treated", "ar": "عدد المرضى الذين جرى تقييمهم أو علاجهم"},
            {"key": "patientsTransported", "en": "Patients transported to hospital / medically evacuated", "ar": "عدد المرضى المنقولين إلى المستشفى أو الذين جرى إخلاؤهم طبياً"},
            {"key": "cardiacArrests", "en": "Cardiac arrests", "ar": "عدد حالات توقف القلب"},
            {"key": "deaths", "en": "Deaths", "ar": "عدد الوفيات"},
            {"key": "unplannedResources", "en": "Unplanned additional medical or EMS resources requested", "ar": "الموارد الطبية أو موارد خدمات الطوارئ الطبية الإضافية غير المخطط لها التي طُلبت"},
            {"key": "coverageHours", "en": "Event medical coverage hours", "ar": "إجمالي ساعات التغطية الطبية للفعالية"},
        ],
        "significantEvents": [
            {"key": "majorIncident", "en": "Major incident", "ar": "حادث جسيم"},
            {"key": "hospitalTransport", "en": "Hospital transport or medical evacuation", "ar": "نقل إلى المستشفى أو إخلاء طبي"},
            {"key": "cardiacArrest", "en": "Cardiac arrest", "ar": "توقف قلبي"},
            {"key": "death", "en": "Death", "ar": "وفاة"},
            {"key": "interrupted", "en": "Event interrupted for medical reasons", "ar": "انقطاع الفعالية لأسباب طبية"},
            {"key": "terminated", "en": "Event terminated for medical reasons", "ar": "إنهاء الفعالية لأسباب طبية"},
            {"key": "unplannedRequest", "en": "Unplanned request for additional medical or EMS resources", "ar": "طلب غير مخطط لموارد طبية أو موارد إضافية من خدمات الطوارئ الطبية"},
            {"key": "none", "en": "None", "ar": "لا شيء مما سبق"},
        ],
        "lessons": {
            "noneEn": "No significant issues identified.",
            "noneAr": "لم تُحدّد أي مشكلات مهمة.",
            "identifiedEn": "Issues or corrective actions identified:",
            "identifiedAr": "حُدّدت مشكلات أو إجراءات تصحيحية، وهي:",
        },
        "declaration": {
            "statementEn": "I certify that the information provided is complete and accurate.",
            "statementAr": "أقر بأن المعلومات الواردة في هذا التقرير كاملة ودقيقة.",
            "organizerEn": "Organizer representative", "organizerAr": "ممثل المنظم",
            "directorEn": "Event Medical Director (Level 3)", "directorAr": "المدير الطبي للفعالية (المستوى الثالث)",
        },
    })

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
