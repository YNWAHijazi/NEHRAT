#!/usr/bin/env python3
"""Slice 6 regulatory data: the Ministry console.

Generates lib/rules/data/ministry.json. Provenance, in order of authority:
  - SPEC 2 for the three outcomes (Arabic verbatim from the Arabic compliance
    form's Ministry-use block) and the two limit sentences;
  - the PAD policy spec section 11 for the TEN Ministry configuration powers
    (the prototype's configuration screen carries the earlier seven-row count
    and is superseded, reported);
  - SPEC 2c for the platform-owner scope (counts only -- the narrow reading of
    an undecided question);
  - the Ministry Review prototype for screen copy that exists nowhere in the
    source, taken verbatim.

The permission matrix is DATA: every role against every action, enforced by
lib/rules/ministry.ts and printed in the handback. Changing who may do what is
an edit here, never a scattered code change.

This script owns everything it writes: regenerate rather than hand-edit.
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "lib" / "rules" / "data"

ministry = {
    "$comment": (
        "The Ministry console. The three outcomes are the ONLY regulatory "
        "determinations and only a reviewer records them; internal workflow states "
        "are grey and are not determinations; an inspector records corrective "
        "actions and can record none of the three. The facility lane is separate "
        "from the event lane and carries no event outcome."
    ),

    # ---- The three outcomes (SPEC 2; Arabic verbatim from the compliance form) ----
    "outcomes": [
        {"key": "incomplete", "en": "Submission received but incomplete", "ar": "تم استلام التقديم، لكنه غير مكتمل"},
        {"key": "revision", "en": "Additional information or revision required", "ar": "يلزم تقديم معلومات إضافية أو إجراء تعديلات"},
        {"key": "satisfied", "en": "Health and medical preparedness requirements satisfied", "ar": "تم استيفاء متطلبات التأهب الصحي والطبي"},
    ],
    "outcomeLimits": [
        {"en": "The Ministry reviews health and medical preparedness only. Authorization of the event remains with the legally competent authority.",
         "ar": "تراجع الوزارة التأهب الصحي والطبي فقط. ويبقى الترخيص بالفعالية لدى السلطة المختصة قانوناً."},
        {"en": "This status does not replace any other permit or authorization required under Lebanese law.",
         "ar": "لا تحل هذه الحالة محل أي تصريح أو ترخيص آخر مطلوب بموجب القانون اللبناني."},
    ],
    # Internal workflow states: grey, quiet, never mistaken for determinations.
    "internalStates": {
        "queued": {"en": "In queue", "ar": "في القائمة"},
        "progress": {"en": "In progress", "ar": "قيد المراجعة"},
        "assigned": {"en": "Assigned", "ar": "مُسند"},
    },
    # A distinct action, not a fourth outcome (SPEC 2). Measures come from the
    # requirement catalogue; the note on one is a note, never a requirement.
    "additionalMeasures": {
        "en": "Require additional measures",
        "ar": "طلب تدابير إضافية",
        "noteEn": "A distinct action, not a fourth outcome. Measures come from the requirement catalogue; nothing outside it can be attached to a submission.",
        "noteAr": "إجراء مستقل، لا نتيجة رابعة. تأتي التدابير من كتالوغ المتطلبات؛ ولا يمكن إرفاق شيء من خارجه بأي تقديم.",
    },

    # ---- The permission matrix: every role against every action ----
    # TRUE means the role may perform the action; enforcement is
    # lib/rules/ministry.ts's can(), asked by every screen and every server
    # action. The rows the Ministry will argue about are deliberate:
    #  - ministry_admin CANNOT record an outcome (configures, never determines);
    #  - inspector records corrective actions and none of the three outcomes;
    #  - platform_owner performs no regulatory action at all -- counts only
    #    (SPEC 2c, the narrow reading of an undecided question);
    #  - the order role acts only while the lane is active (enforced separately).
    "actions": [
        {"key": "viewMinistry", "en": "Open the Ministry console", "ar": "فتح لوحة الوزارة"},
        {"key": "viewQueue", "en": "See the review queue", "ar": "الاطلاع على قائمة المراجعة"},
        {"key": "viewSubmission", "en": "Open a submission under review", "ar": "فتح تقديم قيد المراجعة"},
        {"key": "assignReview", "en": "Assign or take a submission", "ar": "إسناد تقديم أو توليه"},
        {"key": "recordOutcome", "en": "Record one of the three outcomes", "ar": "تسجيل إحدى النتائج الثلاث"},
        {"key": "requireMeasures", "en": "Require additional measures", "ar": "طلب تدابير إضافية"},
        {"key": "recordOrganization", "en": "Record an organization", "ar": "تسجيل مؤسسة"},
        {"key": "respondEnquiry", "en": "Respond to an enquiry", "ar": "الرد على استفسار"},
        {"key": "scheduleInspection", "en": "Schedule an inspection and record findings", "ar": "جدولة تفتيش وتسجيل نتائجه"},
        {"key": "recordCorrective", "en": "Record a corrective action", "ar": "تسجيل إجراء تصحيحي"},
        {"key": "viewFacilityLane", "en": "See the facility lane", "ar": "الاطلاع على مسار المرافق"},
        {"key": "designateCovered", "en": "Designate a facility as covered after review", "ar": "تحديد مرفق كمشمول بعد المراجعة"},
        {"key": "configureMassGathering", "en": "Configure the mass-gathering instrument and versions", "ar": "إعداد إطار الفعاليات الجماهيرية وإصداراته"},
        {"key": "configureCardiac", "en": "Configure the cardiac-arrest values", "ar": "إعداد قيم الجاهزية لتوقف القلب"},
        {"key": "manageUsers", "en": "Manage users and roles", "ar": "إدارة المستخدمين والأدوار"},
        {"key": "viewRegistry", "en": "See the national registry", "ar": "الاطلاع على السجل الوطني"},
        {"key": "orderVerify", "en": "Verify credentials (Order lane, while active)", "ar": "التحقق من المؤهلات (مسار النقابة، أثناء تفعيله)"},
        {"key": "viewPlatformActivity", "en": "See platform activity (counts only)", "ar": "الاطلاع على نشاط المنصة (أعداد فقط)"},
        {"key": "manageFlags", "en": "Master admin — capability flags", "ar": "الإدارة العليا — مفاتيح القدرات"},
    ],
    "matrix": {
        # role -> list of permitted action keys. Roles absent from an action's
        # list are refused. organizer/ems/director/response hold NO ministry action.
        "organizer": [],
        "ems": [],
        "director": [],
        "response": [],
        "reviewer": [
            "viewMinistry", "viewQueue", "viewSubmission", "assignReview",
            "recordOutcome", "requireMeasures", "recordOrganization",
            "respondEnquiry", "recordCorrective", "viewFacilityLane",
            "designateCovered",
        ],
        "inspector": [
            "viewMinistry", "viewQueue", "viewSubmission",
            "scheduleInspection", "recordCorrective", "viewFacilityLane",
        ],
        "ministry_admin": [
            "viewMinistry", "viewQueue", "viewSubmission", "viewFacilityLane",
            "configureMassGathering", "configureCardiac", "manageUsers",
            "viewRegistry",
        ],
        "order": ["orderVerify"],
        "platform_owner": ["viewPlatformActivity", "manageFlags"],
    },

    # ---- The ten Ministry configuration powers (the source's own count) ----
    # Each power carries zero or more configurable VALUES. A value's unset state
    # is a first-class answer; set-and-publish records the value with an
    # effective date, and operators are notified when the obligation begins.
    # act-based powers configure nothing here -- they say where they are
    # exercised. The Slice 4 provisional cycles (readiness-check cadence, lapse
    # window) become configuration under power ten; their placement there is the
    # build's, recorded for the Ministry.
    "cardiacPowers": [
        {"n": 1, "key": "phasedSchedule",
         "en": "Set and revise phased implementation schedules",
         "ar": "وضع خطط التنفيذ المرحلية ومراجعتها",
         "kind": "value",
         "valueLabelEn": "Phased schedule — schools, universities and educational campuses",
         "valueLabelAr": "الجدول المرحلي — المدارس والجامعات والحرم التعليمية",
         "unsetNoteEn": "No obligation is in force against this category until a phase is set and published. Operators who recorded an interest are notified when it is.",
         "unsetNoteAr": "لا يسري أي موجب على هذه الفئة قبل وضع مرحلة ونشرها. ويُبلَّغ المشغّلون الذين سجّلوا اهتماماً عند نشرها."},
        {"n": 2, "key": "capacityThreshold",
         "en": "Set public-venue capacity thresholds",
         "ar": "تحديد عتبات السعة للأماكن العامة",
         "kind": "value",
         "valueLabelEn": "Capacity threshold — malls and other public venues (persons)",
         "valueLabelAr": "عتبة السعة — المراكز التجارية والأماكن العامة الأخرى (أشخاص)",
         "unsetNoteEn": "Airports, passenger ports and central transport terminals are in force by category and depend on no threshold. Everything else in the category waits on this figure.",
         "unsetNoteAr": "المطارات وموانئ الركاب ومحطات النقل المركزية سارية بحكم الفئة ولا تتوقف على عتبة. وكل ما عداها في الفئة ينتظر هذا الرقم."},
        {"n": 3, "key": "designations",
         "en": "Designate remote or difficult-access facilities, or other individual facilities",
         "ar": "تحديد المنشآت النائية أو صعبة الوصول أو منشآت فردية أخرى",
         "kind": "act",
         "actNoteEn": "Works by individual designation. Nothing is in force against a facility until it is designated and its operator notified. Recorded designations are listed here as they are made.",
         "actNoteAr": "يعمل بالتحديد الفردي. ولا يسري شيء على منشأة قبل تحديدها وإبلاغ مشغّلها. وتُدرَج التحديدات المسجَّلة هنا فور صدورها."},
        {"n": 4, "key": "categoryRequirements",
         "en": "Specify additional requirements for particular facility categories",
         "ar": "تحديد متطلبات إضافية لفئات معيّنة من المرافق",
         "kind": "value",
         "valueLabelEn": "Additional category requirements",
         "valueLabelAr": "المتطلبات الإضافية بحسب الفئة",
         "unsetNoteEn": "Where the Ministry requires more of a category than the baseline. None recorded.",
         "unsetNoteAr": "حيث تطلب الوزارة من فئة أكثر من الحد الأساسي. لا شيء مسجَّل."},
        {"n": 5, "key": "reportingProcedures",
         "en": "Establish electronic registration and reporting procedures",
         "ar": "اعتماد إجراءات التسجيل والإبلاغ الإلكترونية",
         "kind": "value",
         "valueLabelEn": "Reporting submission timeframe (days after the incident)",
         "valueLabelAr": "مهلة تقديم الإبلاغ (أيام بعد الحادثة)",
         "unsetNoteEn": "The dataset and incident forms state that the reporting timeframe is set by the Ministry. Until it is set and published, no due date is computed on any report.",
         "unsetNoteAr": "تنص نماذج البيانات والحوادث على أن الوزارة تحدد مهلة الإبلاغ. وقبل تحديدها ونشرها، لا يُحتسب أي تاريخ استحقاق على أي تقرير."},
        {"n": 6, "key": "correctiveTimelines",
         "en": "Set corrective-action timelines",
         "ar": "تحديد مهل الإجراءات التصحيحية",
         "kind": "value",
         "valueLabelEn": "Corrective-action timeline (days from the action being raised)",
         "valueLabelAr": "مهلة الإجراء التصحيحي (أيام من إثارته)",
         "unsetNoteEn": "Corrective actions are raised and tracked, but no due date can be computed until a timeline is set.",
         "unsetNoteAr": "تُثار الإجراءات التصحيحية وتُتابع، لكن لا يمكن احتساب تاريخ استحقاق قبل تحديد مهلة."},
        {"n": 7, "key": "registries",
         "en": "Maintain or authorize AED and cardiac-arrest reporting registries",
         "ar": "إمساك سجلات أجهزة إزالة الرجفان والإبلاغ عن توقف القلب أو الإذن بها",
         "kind": "act",
         "actNoteEn": "The platform's device and incident records are the registry substrate. Geolocation and automated notifications exist as capability flags, off, under Master admin.",
         "actNoteAr": "سجلات الأجهزة والحوادث في المنصة هي أساس السجل. أما تحديد المواقع والإشعارات الآلية فقدرات خلف مفاتيح، مطفأة، ضمن الإدارة العليا."},
        {"n": 8, "key": "arrestLocationReview",
         "en": "Review reported cardiac-arrest locations to identify facilities requiring additional readiness measures",
         "ar": "مراجعة مواقع حوادث توقف القلب المبلَّغة لتحديد المرافق التي تحتاج تدابير جاهزية إضافية",
         "kind": "act",
         "actNoteEn": "Exercised on Reported arrest locations: incidents grouped by place and category, and the mechanism by which a facility with a confirmed arrest becomes covered.",
         "actNoteAr": "تُمارَس في مواقع الحوادث المبلَّغة: الحوادث مجمَّعة بحسب المكان والفئة، وهي الآلية التي يصبح بها مرفق ذو توقف قلب مؤكَّد مشمولاً."},
        {"n": 9, "key": "formsGuidance",
         "en": "Issue or update standardized forms and technical guidance",
         "ar": "إصدار النماذج الموحدة والإرشادات التقنية أو تحديثها",
         "kind": "act",
         "actNoteEn": "Form versions ride on Configuration and versioning; a new issue of a form is a version there, not an edit in place.",
         "actNoteAr": "تُدار إصدارات النماذج في الإعدادات والإصدارات؛ فالإصدار الجديد لنموذج هو إصدار هناك، لا تعديل في مكانه."},
        {"n": 10, "key": "readinessRequests",
         "en": "Request readiness confirmation and require corrective action where deficiencies are identified",
         "ar": "طلب تأكيد الجاهزية واشتراط الإجراء التصحيحي عند اكتشاف قصور",
         "kind": "value",
         "valueLabelEn": "Readiness cycles — device-check cadence (days) and lapse window (days)",
         "valueLabelAr": "دورات الجاهزية — وتيرة فحص الأجهزة (أيام) ونافذة الانتهاء (أيام)",
         "valueKeys": ["checkCycleDays", "lapseWindowDays"],
         "unsetNoteEn": "The validity ledger runs on provisional cycles until these are set and published; publishing replaces the provisional figures everywhere they are used. Their placement under this power is the build's, recorded for the Ministry.",
         "unsetNoteAr": "يعمل سجل الصلاحية بدورات مؤقتة إلى أن تُحدَّد هذه القيم وتُنشر؛ والنشر يستبدل الأرقام المؤقتة أينما استُخدمت. ووضعها تحت هذه الصلاحية اجتهاد من البناء، مسجَّل للوزارة."},
    ],
    "publicationStates": {
        "published": {"en": "Published", "ar": "منشورة"},
        "part": {"en": "Partly published", "ar": "منشورة جزئياً"},
        "unset": {"en": "Not yet published", "ar": "لم تُنشر بعد"},
        "caseByCase": {"en": "Set case by case", "ar": "تُحدَّد حالة بحالة"},
        "provisional": {"en": "Provisional figure in use", "ar": "رقم مؤقت مستخدم"},
    },
    "setAndPublish": {
        "en": "Set and publish", "ar": "التحديد والنشر",
        "effectiveEn": "Effective date", "effectiveAr": "تاريخ السريان",
        "notifyEn": "Publishing notifies the operators the value reaches, on the effective date named.",
        "notifyAr": "النشر يُبلّغ المشغّلين الذين تصلهم القيمة، بتاريخ السريان المسمّى.",
    },
    "inForceWithoutValue": {
        "en": "Two categories are in force without any configured value — sports and aquatic facilities, and airports, ports and central transport terminals — so they do not appear among the configurable rows.",
        "ar": "فئتان ساريتان دون أي قيمة مُعدّة — المنشآت الرياضية والمائية، والمطارات والموانئ ومحطات النقل المركزية — ولذلك لا تظهران بين الصفوف القابلة للإعداد.",
    },

    # ---- Platform activity: counts only (SPEC 2c, the narrow reading) ----
    "activityScope": {
        "en": "Counts only. No organizer, account, event or patient is named here, and nothing filters to one organization's behaviour. The wider owner visibility described in the product specification is an undecided question recorded for the Ministry; this stays narrow until it rules.",
        "ar": "أعداد فقط. لا يُسمّى هنا منظِّم ولا حساب ولا فعالية ولا مريض، ولا شيء يُرشَّح إلى سلوك مؤسسة واحدة. أما رؤية المالك الأوسع الموصوفة في مواصفات المنتج فمسألة غير محسومة مسجَّلة للوزارة؛ ويبقى هذا ضيقاً إلى أن تبتّ فيها."
    },

    # ---- The Order lane on Users and roles ----
    "orderSuspension": {
        "en": "The Order of Physicians lane is off. The Order reviewer account is suspended with it — the role is listed, its access is not.",
        "ar": "مسار نقابة الأطباء مطفأ. وحساب مراجع النقابة موقوف معه — الدور مُدرَج، والوصول لا.",
    },
    "roleLabels": {
        "reviewer": {"en": "Reviewer", "ar": "مراجع"},
        "inspector": {"en": "Inspector", "ar": "مفتش"},
        "ministry_admin": {"en": "Administrator", "ar": "مسؤول إداري"},
        "order": {"en": "Order of Physicians reviewer", "ar": "مراجع نقابة الأطباء"},
        "platform_owner": {"en": "Platform owner", "ar": "مالك المنصة"},
    },
}

path = OUT / "ministry.json"
path.write_text(json.dumps(ministry, ensure_ascii=False, indent=2) + "\n")
print(f"wrote {path.relative_to(OUT.parent.parent.parent)}")
