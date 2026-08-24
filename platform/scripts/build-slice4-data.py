#!/usr/bin/env python3
"""Slice 4 regulatory data: the facility service (cardiac-arrest instrument).

Generates lib/rules/data/facility.json. Provenance, in order of authority:
  - source-documents/en/06 (the PAD policy spec) for structure and English wording;
  - source-documents/ar/06 PAD annexes A-D for Arabic wording (the Arabic issue wins
    over the prototype's Arabic wherever both exist);
  - the Organizer Journey prototype for screen copy that exists nowhere in the source
    (category basis notes, crew callout, ledger phrasing), taken verbatim.

Like build-slice2-data.py, this script owns everything it writes: regenerate rather
than hand-edit.
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "lib" / "rules" / "data"

facility = {
    "$comment": (
        "The cardiac-arrest instrument's facility service. Vocabulary rule (SPEC 2b): "
        "this instrument is READINESS -- الجاهزية -- and never التأهب. Status labels "
        "(Current/Lapsing/Lapsed, the standing lines) are PROVISIONAL: the policy "
        "prescribes no status vocabulary and final labels await Ministry approval "
        "(policy 10, SPEC status note); provisionalNote below must render wherever "
        "they appear. Mass-gathering outcome vocabulary never appears here."
    ),

    # ---- Annex A parts 1-2: the six categories and their requirement logic ----
    # shortEn/shortAr are dashboard-row display labels: 'sports' is the reference's
    # own compression; the other five are build compressions pending review.
    # English from the policy spec 3; Arabic from ar Annex A part 2 (the requirements
    # table). Part 1's fuller list adds أحواض السباحة to category 1 -- an internal
    # divergence of the Arabic issue, recorded here and reported, not reconciled.
    # rule/basis prose beyond the instrument is the prototype's, taken verbatim.
    # state maps to the four chips in lib/rules/gates.ts (StateChip).
    "categories": [
        {
            "key": "sports",
            "en": "Gyms, fitness centres, sports clubs, stadiums, athletic and aquatic facilities",
            "ar": "النوادي الرياضية، ومراكز اللياقة البدنية، والأندية الرياضية، والملاعب، والمنشآت الرياضية، والمنشآت المائية",
            "arNote": "Part 1 of the Arabic issue adds أحواض السباحة (swimming pools) to this category; part 2's table omits it. The table wording is used; the divergence is recorded for the Ministry.",
            "state": "inForceNow",
            "alsoRecurringVenue": True,
            "shortEn": "Sports and aquatic facility", "shortAr": "منشأة رياضية ومائية",
            "ruleEn": "A defibrillator is required, with the continuing obligations that go with it.",
            "ruleAr": "يُطلب جهاز إزالة رجفان، مع الموجبات المستمرة المرتبطة به.",
            "basisEn": "The category carries the requirement on its own. Nothing further has to be decided for it to apply.",
            "basisAr": "تحمل الفئة المتطلب بنفسها. ولا يلزم البت في شيء آخر ليسري.",
        },
        {
            "key": "education",
            "shortEn": "Educational campus", "shortAr": "حرم تعليمي",
            "en": "Schools, universities and educational campuses",
            "ar": "المدارس، والجامعات، والمجمعات التعليمية",
            "state": "awaitingMinistryValue",
            "ruleEn": "A defibrillator is required on the Ministry’s phased schedule.",
            "ruleAr": "يُطلب جهاز إزالة رجفان وفق خطة التنفيذ المرحلية المعتمدة من الوزارة.",
            "basisEn": "The schedule has not been set. Until the Ministry sets it and activates a phase covering your kind of institution, no requirement is in force against this category.",
            "basisAr": "لم تُوضع خطة التنفيذ المرحلية بعد. وإلى أن تضعها الوزارة وتفعّل مرحلة تشمل نوع مؤسستكم، لا يسري أي متطلب على هذه الفئة.",
            "missingEn": "The phased implementation schedule",
            "missingAr": "خطة التنفيذ المرحلية",
        },
        {
            "key": "transport",
            "shortEn": "Transport hub or large public venue", "shortAr": "محطة نقل أو مكان عام كبير",
            "en": "Airports, passenger ports, central transport terminals, shopping malls and public venues above a Ministry capacity threshold",
            "ar": "المطارات، ومرافئ الركاب، ومحطات النقل المركزية، ومراكز التسوق، والأماكن العامة التي تتجاوز الحد الذي تحدده الوزارة",
            "state": "partlyInForce",
            "ruleEn": "Airports, passenger ports and central transport terminals are required. Shopping malls and other public venues are required only above the Ministry capacity threshold.",
            "ruleAr": "المطارات ومرافئ الركاب ومحطات النقل المركزية مطلوبة. أما مراكز التسوق والأماكن العامة الأخرى فمطلوبة فوق حد السعة الذي تحدده الوزارة فقط.",
            "basisEn": "If your facility is an airport, passenger port or central transport terminal, the requirement is in force now. If it is a shopping mall or another public venue, whether it applies turns on a figure the Ministry has not published.",
            "basisAr": "إذا كانت منشأتكم مطاراً أو مرفأ ركاب أو محطة نقل مركزية، فالمتطلب سارٍ الآن. وإذا كانت مركز تسوق أو مكاناً عاماً آخر، فسريانه يتوقف على رقم لم تنشره الوزارة.",
        },
        {
            "key": "remote",
            "shortEn": "Remote facility", "shortAr": "منشأة نائية",
            "en": "Remote or difficult-access facilities",
            "ar": "المرافق الواقعة في المناطق النائية أو التي يصعب الوصول إليها",
            "state": "awaitingMinistryValue",
            "ruleEn": "A defibrillator is required where the Ministry designates the facility.",
            "ruleAr": "يُطلب جهاز إزالة رجفان إذا حددت الوزارة المنشأة.",
            "basisEn": "This category works by individual designation. Nothing is in force against a facility until the Ministry designates it and notifies the operator.",
            "basisAr": "تعمل هذه الفئة بالتحديد الفردي. ولا يسري شيء على منشأة قبل أن تحددها الوزارة وتبلّغ المشغّل.",
            "missingEn": "An individual designation",
            "missingAr": "تحديد فردي",
        },
        {
            "key": "priorArrest",
            "shortEn": "Facility under Ministry review", "shortAr": "مرفق قيد مراجعة الوزارة",
            "en": "Fixed facilities where a cardiac arrest has previously been reported and confirmed",
            "ar": "المرافق التي سبق الإبلاغ فيها عن حالة توقف قلب وثبتت من قبل الوزارة",
            "arNote": "The Arabic issue's part 1 is broader: it names who reports (EMS or an approved first-response agency) and who confirms (the Ministry). Recorded for the Ministry; the requirements-table wording is used.",
            "state": "determinedByReview",
            "ruleEn": "The facility becomes subject to Ministry review, and the review states what is required.",
            "ruleAr": "تخضع المنشأة لمراجعة الوزارة، وتبيّن المراجعة متطلبات الجاهزية التي تقررها.",
            "basisEn": "A confirmed report is the trigger. The requirement comes from the review, not automatically from the category.",
            "basisAr": "الإبلاغ المؤكد هو المحفّز. ويأتي المتطلب من المراجعة لا تلقائياً من الفئة.",
        },
        {
            "key": "designated",
            "shortEn": "Ministry-designated facility", "shortAr": "مرفق حددته الوزارة",
            "en": "Other facilities the Ministry designates",
            "ar": "أي مرفق آخر تحدده الوزارة",
            "state": "awaitingMinistryValue",
            "ruleEn": "Requirements are whatever the designation specifies.",
            "ruleAr": "المتطلبات وفقاً لما تحدده الوزارة.",
            "basisEn": "This category exists so the Ministry can bring in a facility no other category reaches. Nothing is in force without a designation.",
            "basisAr": "توجد هذه الفئة لتتمكن الوزارة من إدخال منشأة لا تصلها فئة أخرى. ولا يسري شيء دون تحديد.",
            "missingEn": "An individual designation",
            "missingAr": "تحديد فردي",
        },
    ],

    # The end-of-journey copy where the category awaits a Ministry value (ROADMAP 2d:
    # no Continue button appears; the prototype's wording, verbatim).
    "categoryUnset": {
        "en": "This is the answer, not a gap in it. Until the Ministry sets and publishes the value, nothing under this category is in force and no registration is owed. You have done everything available to you.",
        "ar": "هذا هو الجواب، لا نقص فيه. وإلى أن تحدد الوزارة القيمة وتنشرها، لا يسري شيء بموجب هذه الفئة ولا يُستحق أي تسجيل. وقد فعلتم كل ما هو متاح لكم.",
        "interestEn": "Record an interest and notify us when it activates",
        "interestAr": "تسجيل اهتمام وإبلاغنا عند التفعيل",
    },
    "venueCross": {
        "en": "A sports facility that regularly hosts organized events and is licensed for 1,000 or more is also a recurring venue. Both apply, each with its own registration, and where their requirements differ the higher governs.",
        "ar": "المنشأة الرياضية التي تستضيف بانتظام فعاليات منظّمة والمرخّصة لألف شخص أو أكثر هي أيضاً موقع فعاليات متكرر. وينطبق الإطاران، لكل منهما تسجيله، وحيث تختلف متطلباتهما يسري الأعلى.",
    },

    # ---- Annex B section 1: the facility profile (Arabic from ar Annex B) ----
    # name and municipality are proper nouns entered in both languages, following the
    # Slice 3 ruling on the venue's municipality.
    "profileFields": [
        {"key": "name", "en": "Facility name", "ar": "اسم المرفق", "bilingual": True},
        {"key": "address", "en": "Address", "ar": "العنوان"},
        {"key": "municipality", "en": "Municipality", "ar": "البلدية", "bilingual": True},
        {"key": "hours", "en": "Operating hours", "ar": "ساعات العمل"},
        {"key": "phone", "en": "Facility telephone", "ar": "هاتف المرفق"},
        {"key": "email", "en": "Facility email", "ar": "البريد الإلكتروني للمرفق"},
    ],
    "accessFields": [
        {"key": "accessPoint", "en": "Main entrance or ambulance access point", "ar": "المدخل الرئيسي أو نقطة وصول خدمات الطوارئ الطبية",
         "hintEn": "Describe it as a crew would find it.", "hintAr": "صفوها كما تجدها الفرقة."},
        {"key": "emsNumber", "en": "The ambulance number this facility uses", "ar": "رقم خدمات الطوارئ الطبية المعتمد لدى المرفق"},
    ],
    "crewCallout": {
        "labelEn": "What a responding crew needs", "labelAr": "ما تحتاجه فرقة الاستجابة",
        "en": "These two are not administrative detail. The access point is where an ambulance is directed on the night, and the number asked for is the one this facility actually dials — not a national default.",
        "ar": "هذان البندان ليسا تفصيلاً إدارياً. فنقطة الوصول هي المكان الذي تُوجَّه إليه سيارة الإسعاف ليلتها، والرقم المطلوب هو الرقم الذي تتصل به هذه المنشأة فعلاً — لا رقماً وطنياً افتراضياً.",
    },

    # ---- Annex B section 2: the three responsible persons ----
    # One coordinator record referenced everywhere (ROADMAP 2d). Arabic from ar Annex B.
    "persons": [
        {"key": "coordinator", "en": "Facility cardiac-readiness coordinator",
         "ar": "منسق الجاهزية للاستجابة لحالات توقف القلب في المرفق",
         "noteEn": "One named person for this facility. The same person appears on every device record and on the response plan.",
         "noteAr": "شخص واحد مُسمّى لهذه المنشأة. ويظهر نفسه على كل سجل جهاز وعلى خطة الاستجابة."},
        {"key": "alternate", "en": "Alternate contact", "ar": "جهة الاتصال البديلة",
         "noteEn": "Reached when the coordinator is not available.",
         "noteAr": "يُتواصَل معها عند عدم توفر المنسّق."},
        {"key": "emsGuide", "en": "Person assigned to receive and guide ambulance crews",
         "ar": "الشخص المكلف باستقبال وإرشاد فرق خدمات الطوارئ الطبية",
         "noteEn": "Meets the crew at the access point recorded in the profile and takes them to the patient.",
         "noteAr": "يلتقي الفرقة عند نقطة الوصول المسجّلة في الملف ويأخذها إلى المريض."},
    ],
    "personFields": [
        {"key": "nameOrPosition", "en": "Name or position", "ar": "الاسم أو المسمى الوظيفي"},
        {"key": "phone", "en": "Telephone", "ar": "رقم الهاتف"},
        {"key": "email", "en": "Email", "ar": "البريد الإلكتروني"},
    ],
    "coordinatorOneRecord": {
        "en": "The coordinator recorded here is the coordinator on every device record and on the response plan. It is one record referenced by all of them, so the three can never disagree.",
        "ar": "المنسّق المسجَّل هنا هو المنسّق على كل سجل جهاز وعلى خطة الاستجابة. وهو سجل واحد تُحيل إليه جميعها، فلا يمكن أن تتعارض الثلاثة.",
    },

    # ---- Annex C: the device record (Arabic from ar Annex C) ----
    "deviceFields": [
        {"key": "identification", "en": "Barcode, QR code or serial number",
         "ar": "الرمز الشريطي (Barcode) أو رمز الاستجابة السريعة (QR Code) أو الرقم التسلسلي"},
        {"key": "location", "en": "Exact location within the facility", "ar": "الموقع الدقيق للجهاز داخل المرفق"},
        {"key": "accessibleHours", "en": "Accessible during operating hours", "ar": "إمكانية الوصول إلى الجهاز خلال ساعات العمل", "kind": "yesno"},
        {"key": "publiclyAccessible", "en": "Publicly accessible", "ar": "إمكانية وصول العموم إلى الجهاز", "kind": "yesno"},
        {"key": "pediatric", "en": "Pediatric capability, where applicable", "ar": "خاصية الاستخدام للأطفال، عند الاقتضاء", "kind": "yesnona"},
    ],
    "deviceReadinessChecks": [
        {"key": "operational", "en": "AED operational", "ar": "جهاز إزالة الرجفان الخارجي الآلي صالح للتشغيل"},
        {"key": "pads", "en": "Pads present and within expiry", "ar": "الأقطاب الكهربائية متوافرة ولم تتجاوز تاريخ انتهاء صلاحيتها"},
        {"key": "battery", "en": "Battery functional", "ar": "البطارية صالحة للاستعمال"},
        {"key": "signage", "en": "Signage visible", "ar": "لافتات جهاز إزالة الرجفان الخارجي الآلي واضحة وظاهرة"},
    ],
    "deviceDates": [
        {"key": "latestCheck", "en": "Date of latest readiness check", "ar": "تاريخ آخر فحص للجاهزية"},
        {"key": "padExpiry", "en": "Electrode pad expiry date", "ar": "تاريخ انتهاء صلاحية الأقطاب الكهربائية"},
        {"key": "batteryExpiry", "en": "Battery replacement or expiry date, if available", "ar": "تاريخ استبدال البطارية أو تاريخ انتهاء صلاحيتها، إن وجد"},
    ],
    # Annex C section 5 -- the five registration purposes, Arabic verbatim.
    "devicePurposes": [
        {"key": "initial", "en": "Initial registration", "ar": "التسجيل الأولي", "ctaEn": "Register device", "ctaAr": "تسجيل الجهاز"},
        {"key": "annual", "en": "Annual readiness confirmation", "ar": "تأكيد الجاهزية السنوي", "ctaEn": "Confirm readiness", "ctaAr": "تأكيد الجاهزية"},
        {"key": "relocation", "en": "Update after relocation", "ar": "تحديث بعد نقل الجهاز إلى موقع آخر", "ctaEn": "Save new location", "ctaAr": "حفظ الموقع الجديد"},
        {"key": "replacement", "en": "Update after replacement", "ar": "تحديث بعد استبدال الجهاز", "ctaEn": "Save replacement", "ctaAr": "حفظ الاستبدال"},
        {"key": "statusChange", "en": "Update after operational or accessibility status change", "ar": "تحديث نتيجة تغيير في الحالة التشغيلية أو في إمكانية الوصول إلى الجهاز", "ctaEn": "Save change", "ctaAr": "حفظ التغيير"},
    ],
    "deviceConfirmation": {
        "$comment": "Annex C section 6, Arabic verbatim. Signed by the FACILITY REPRESENTATIVE -- a different signatory from the plan's coordinator (ROADMAP 2d).",
        "en": "I confirm that the information in this form is accurate and that the AED is operational.",
        "ar": "أقر بأن المعلومات الواردة في هذا النموذج صحيحة، وأن جهاز إزالة الرجفان الخارجي الآلي صالح للتشغيل.",
        "signatoryEn": "Facility representative", "signatoryAr": "ممثل المرفق",
    },

    # ---- Annex B section 4: the immediate response procedure ----
    # EIGHT steps (the source; earlier documents said seven -- SPEC correction note).
    # Arabic verbatim from ar Annex B; the prototype's compressed Arabic is superseded.
    "procedure": [
        {"n": 1, "en": "Confirm the person is unresponsive and not breathing normally", "ar": "التأكد من أن الشخص غير مستجيب ولا يتنفس بصورة طبيعية"},
        {"n": 2, "en": "Contact EMS immediately", "ar": "الاتصال بخدمات الطوارئ الطبية فوراً"},
        {"n": 3, "en": "Start CPR", "ar": "البدء بالإنعاش القلبي الرئوي"},
        {"n": 4, "en": "Retrieve and apply the AED", "ar": "إحضار جهاز إزالة الرجفان الخارجي الآلي واستخدامه"},
        {"n": 5, "en": "Follow AED instructions and continue CPR", "ar": "اتباع التعليمات الصوتية أو المرئية الصادرة عن الجهاز، مع الاستمرار في الإنعاش القلبي الرئوي"},
        {"n": 6, "en": "Send the assigned person to meet and guide EMS", "ar": "تكليف الشخص المحدد باستقبال فرق خدمات الطوارئ الطبية وإرشادها إلى موقع الحالة"},
        {"n": 7, "en": "Continue care until responsibility is transferred", "ar": "الاستمرار في تقديم الرعاية إلى حين تسليم الحالة إلى خدمات الطوارئ الطبية أو إلى أي جهة طبية مختصة أخرى"},
        {"n": 8, "en": "Complete the required incident report", "ar": "استكمال تقرير الحادثة المطلوب"},
    ],
    # National emergency numbers shown beside the procedure. Contact data, not
    # regulatory thresholds; kept here so no component hard-codes them.
    "emergencyNumbers": [
        {"en": "Red Cross", "ar": "الصليب الأحمر", "number": "140"},
        {"en": "Civil Defence", "ar": "الدفاع المدني", "number": "125"},
    ],

    # ---- Annex B section 5: readiness confirmation (checkboxes + drill date) ----
    "planChecks": [
        {"key": "trained", "en": "CPR- and AED-trained personnel available during operating hours", "ar": "توافر أشخاص مدرّبين على الإنعاش القلبي الرئوي واستخدام جهاز إزالة الرجفان الخارجي الآلي خلال ساعات العمل"},
        {"key": "signage", "en": "AED signage visible", "ar": "لافتات جهاز إزالة الرجفان الخارجي الآلي واضحة وظاهرة"},
        {"key": "access", "en": "AED access not unnecessarily delayed", "ar": "لا توجد عوائق تؤدي إلى تأخير غير مبرر في الوصول إلى الجهاز"},
        {"key": "routes", "en": "EMS entrance and access routes clear", "ar": "مداخل المرفق ومسارات وصول خدمات الطوارئ الطبية واضحة وخالية من العوائق"},
        {"key": "staffKnow", "en": "Staff know the immediate response procedure", "ar": "العاملون على دراية بإجراءات الاستجابة الفورية"},
        {"key": "drill", "en": "Practical drill conducted during previous 12 months", "ar": "تم تنفيذ تمرين عملي خلال الاثني عشر شهراً السابقة"},
    ],
    "drillDateField": {"en": "Date of latest drill", "ar": "تاريخ آخر تمرين عملي"},
    "planTitle": {
        "$comment": "The plan's name, from the ar Annex B title. SPEC 7's glossary says خطة الاستجابة لحالات توقف القلب; the annex itself says لطوارئ. The source outranks the summary; divergence reported.",
        "en": "Cardiac emergency response plan", "ar": "خطة الاستجابة لطوارئ توقف القلب",
    },
    "planDerivedNote": {
        "en": "Not editable here. Every value below is read from the device records, so the plan and the registry cannot drift apart. Change a device to change this.",
        "ar": "غير قابلة للتحرير هنا. وتُقرأ كل قيمة أدناه من سجلات الأجهزة، فلا يمكن أن تتباعد الخطة والسجل. غيّروا الجهاز ليتغير هذا.",
    },

    # ---- Annex D: the incident report (Arabic verbatim from ar Annex D) ----
    # Tri-state answers are the source's; the prototype's plain Yes/No pills were a
    # simplification and are superseded (source over prototype, reported).
    "incident": {
        "noPatientName": {
            "en": "This report must not contain the patient's name or any unnecessary identifying information. Write “the patient”.",
            "ar": "يجب عدم تضمين اسم المريض أو أي معلومات تعريفية غير ضرورية. اكتب «المريض».",
        },
        "infoFields": [
            {"key": "date", "en": "Date of incident", "ar": "تاريخ الحادثة"},
            {"key": "time", "en": "Approximate time", "ar": "الوقت التقريبي"},
            {"key": "location", "en": "Location within the facility", "ar": "موقع الحادثة داخل المرفق"},
        ],
        "immediateResponse": [
            {"key": "emsContacted", "en": "EMS contacted", "ar": "تم الاتصال بخدمات الطوارئ الطبية", "answers": "yesNoUnknown"},
            {"key": "cprStarted", "en": "CPR started before professional responders arrived", "ar": "بدأ الإنعاش القلبي الرئوي قبل وصول المستجيبين المهنيين", "answers": "yesNoUnknown"},
            {"key": "aedAvailable", "en": "Onsite AED available", "ar": "كان جهاز إزالة الرجفان الخارجي الآلي متوافراً في الموقع", "answers": "yesNo"},
            {"key": "aedApplied", "en": "Onsite AED applied", "ar": "تم استخدام جهاز إزالة الرجفان الخارجي الآلي الموجود في الموقع", "answers": "yesNoUnknown"},
            {"key": "shock", "en": "Shock delivered, if known", "ar": "تم إعطاء صدمة كهربائية، إذا كان ذلك معروفاً", "answers": "yesNoUnknown"},
            {"key": "guided", "en": "Someone met and guided responders to the patient", "ar": "تم استقبال أفراد خدمات الطوارئ الطبية وإرشادهم إلى المريض", "answers": "yesNoNa"},
        ],
        "emsAttendance": [
            {"key": "emsAttended", "en": "EMS agency attended", "ar": "حضرت خدمات الطوارئ الطبية إلى الموقع", "answers": "yesNoUnknown"},
            {"key": "agencyName", "en": "Name of EMS agency, if known", "ar": "اسم جهة خدمات الطوارئ الطبية، إن كان معروفاً", "answers": "text"},
            {"key": "transportedBy", "en": "Patient transported by", "ar": "تم نقل المريض بواسطة", "answers": "transport"},
            {"key": "hospital", "en": "Receiving emergency department or hospital, if known", "ar": "قسم الطوارئ أو المستشفى المستقبِل، إن كان معروفاً", "answers": "text"},
        ],
        "transportOptions": [
            {"key": "ems", "en": "EMS ambulance", "ar": "سيارة إسعاف تابعة لخدمات الطوارئ الطبية"},
            {"key": "private", "en": "Private vehicle", "ar": "مركبة خاصة"},
            {"key": "other", "en": "Other", "ar": "وسيلة أخرى"},
            {"key": "none", "en": "Not transported", "ar": "لم يتم النقل"},
            {"key": "unknown", "en": "Unknown", "ar": "غير معروف"},
        ],
        "postIncident": [
            {"key": "aedChecked", "en": "AED checked after the incident, where applicable", "ar": "تم فحص جهاز إزالة الرجفان الخارجي الآلي بعد الحادثة، عند الاقتضاء", "answers": "check"},
            {"key": "padsReplaced", "en": "Used pads or supplies replaced", "ar": "تم استبدال الأقطاب الكهربائية أو المستلزمات المستخدمة", "answers": "checkNa"},
            {"key": "returned", "en": "AED returned to operational service", "ar": "أُعيد جهاز إزالة الرجفان الخارجي الآلي إلى حالته التشغيلية", "answers": "checkNa"},
            {"key": "reviewed", "en": "Response reviewed by the facility", "ar": "تمت مراجعة الاستجابة من قبل المرفق", "answers": "check"},
        ],
        "correctiveField": {
            "$comment": "Free text per Annex D, not a checkbox (the prototype's fifth check row is superseded by the source).",
            "en": "Problems identified or corrective actions required",
            "ar": "المشكلات التي تم تحديدها أو الإجراءات التصحيحية المطلوبة",
        },
        "narrative": {
            "titleEn": "What happened", "titleAr": "ماذا حصل",
            "hintEn": "Describe the response, not the person. Refer to “the patient”.",
            "hintAr": "صِف الاستجابة لا الشخص. استخدم كلمة «المريض».",
            "flagTitleEn": "This looks like a personal name", "flagTitleAr": "يبدو هذا اسماً شخصياً",
            "flagBodyEn": "Replace it with “the patient” or a role, such as “the lifeguard”. The report cannot be submitted while a name is present.",
            "flagBodyAr": "استبدله بكلمة «المريض» أو بصفة وظيفية مثل «المنقذ». لا يمكن تقديم التقرير مع وجود اسم.",
        },
        "submittedBy": {
            "labelEn": "Facility cardiac-readiness coordinator", "labelAr": "منسق الجاهزية للاستجابة لحالات توقف القلب في المرفق",
            "dateEn": "Date submitted", "dateAr": "تاريخ تقديم التقرير",
        },
        "footerEn": "The Ministry receives this report. It is not shared with any commercial party.",
        "footerAr": "تتلقى الوزارة هذا التقرير. لا يُشارك مع أي جهة تجارية.",
    },

    # ---- The validity ledger (the facility readiness screen) ----
    # Obligation kinds and cycles. Drill and annual confirmation are annual in the
    # policy. The readiness-check cycle and the lapse window are NOT in the policy --
    # provisional values pending a Ministry timeframe (policy 14: reporting timeframes
    # are set by MOPH), configurable here so no code change is needed when it rules.
    "ledger": {
        "obligations": [
            {"key": "padExpiry", "en": "Electrode pad expiry", "ar": "انتهاء صلاحية الأقطاب الكهربائية", "source": "device", "actionEn": "Record replacement", "actionAr": "تسجيل الاستبدال"},
            {"key": "batteryExpiry", "en": "Battery expiry", "ar": "انتهاء البطارية", "source": "device", "actionEn": "Record replacement", "actionAr": "تسجيل الاستبدال"},
            {"key": "latestCheck", "en": "Latest readiness check", "ar": "آخر فحص للجاهزية", "source": "device", "cycleKey": "checkCycleDays", "actionEn": "Record a check", "actionAr": "تسجيل فحص"},
            {"key": "drill", "en": "Annual practical drill", "ar": "تمرين عملي سنوي", "source": "plan", "cycleKey": "annualMonths", "actionEn": "Record a drill", "actionAr": "تسجيل تمرين"},
            {"key": "annualConfirmation", "en": "Annual readiness confirmation", "ar": "تأكيد الجاهزية السنوي", "source": "plan", "cycleKey": "annualMonths", "actionEn": "Confirm now", "actionAr": "التأكيد الآن"},
            {"key": "coordinator", "en": "Coordinator details", "ar": "بيانات المنسّق", "source": "coordinator", "cycleKey": "annualMonths", "actionEn": "Review details", "actionAr": "مراجعة البيانات"},
        ],
        "cycles": {
            "$comment": "annualMonths is the policy's own cadence (annual drill, annual confirmation). checkCycleDays and lapseWindowDays are PROVISIONAL -- no timeframe is in force until the Ministry sets one; these mirror the reference prototype for review.",
            "annualMonths": 12,
            "checkCycleDays": 90,
            "lapseWindowDays": 60,
        },
        "intro": {
            "en": "Readiness is not a score and does not progress. Each obligation below is affirmed on a date and stops counting on a date.",
            "ar": "الجاهزية ليست نتيجة ولا تتقدّم. كل موجب أدناه يُثبَّت بتاريخ ويتوقف احتسابه بتاريخ.",
        },
        "columns": [
            {"en": "Obligation", "ar": "الموجب"},
            {"en": "Last affirmed", "ar": "آخر إثبات"},
            {"en": "Stops counting", "ar": "يتوقف احتسابه"},
            {"en": "Status", "ar": "الحالة"},
        ],
    },
    # Status labels -- PROVISIONAL, see $comment at top. provisionalNote renders on
    # every screen that uses them (SPEC: marked as such wherever it appears).
    "statuses": {
        "current": {"en": "Current", "ar": "ساري"},
        "lapsing": {"en": "Lapsing", "ar": "يقترب من الانتهاء"},
        "lapsed": {"en": "Lapsed", "ar": "منتهٍ"},
        "notRecorded": {"en": "Not yet recorded", "ar": "لم يُسجَّل بعد"},
    },
    "standingShort": {
        "$comment": "The dashboard facility row's state, the reference's own strings. The long lines below belong to the readiness screen.",
        "met": {"en": "Obligations being met", "ar": "الموجبات مستوفاة"},
        "notMet": {"en": "Obligations not being met", "ar": "الموجبات غير مستوفاة"},
    },
    "standing": {
        "met": {"en": "Obligations are being met. Nothing lapses within {days} days.", "ar": "الموجبات مستوفاة. لا شيء ينتهي خلال {days} يوماً."},
        "lapsing": {"enOne": "Obligations are being met. 1 item lapses within {days} days.", "enMany": "Obligations are being met. {n} items lapse within {days} days.", "ar": "الموجبات مستوفاة. {n} بند ينتهي خلال {days} يوماً."},
        "lapsed": {"enOne": "Obligations are not being met. 1 item has stopped counting.", "enMany": "Obligations are not being met. {n} items have stopped counting.", "ar": "الموجبات غير مستوفاة. توقّف احتساب {n} بند."},
    },
    "provisionalNote": {
        "en": "Status wording on this screen is provisional. The instrument prescribes no status labels; final wording awaits the Ministry.",
        "ar": "صياغة الحالات في هذه الشاشة مؤقتة. فالإطار لا يفرض تسميات للحالات، والصياغة النهائية بانتظار الوزارة.",
    },

    # ---- The 12 cross-module reference block (event plan) ----
    "reference": {
        "confirmation": {
            "en": "I confirm the referenced arrangements will remain accessible and operational throughout the event.",
            "ar": "أؤكد أن الترتيبات المُحال إليها ستبقى متاحة وصالحة للتشغيل طوال مدة الفعالية.",
        },
        "confirmNote": {
            "en": "This confirmation is the organizer's own. It is not inherited from the facility's registration.",
            "ar": "هذا التأكيد يخص المنظّم نفسه، ولا يُستمد من تسجيل المرفق.",
        },
        "questions": [
            {"key": "admitsChildren", "en": "The event admits children", "ar": "تستقبل الفعالية أطفالاً"},
            {"key": "temporaryAreas", "en": "Temporary areas are added outside the registered facility footprint", "ar": "تُضاف مناطق مؤقتة خارج نطاق المرفق المسجَّل"},
        ],
        "shortfalls": {
            "pediatric": {
                "en": "Pediatric capability", "ar": "القدرة على التعامل مع الأطفال",
                "detailEn": "No pediatric pads registered against any device at this facility",
                "detailAr": "لا لصاقات أطفال مسجّلة على أي جهاز في هذا المرفق",
                "bodyEn": "This event admits children. The facility registration does not provide pediatric pads, so the event requirement is the higher of the two and you must provide them.",
                "bodyAr": "تستقبل هذه الفعالية أطفالاً. ولا يوفر تسجيل المرفق لصاقات أطفال، فمتطلب الفعالية هو الأعلى وعليكم تأمينها.",
            },
            "footprint": {
                "en": "Coverage of the temporary spectator area", "ar": "تغطية منطقة الجمهور المؤقتة",
                "detailEn": "Outside the registered facility footprint",
                "detailAr": "خارج نطاق المرفق المسجَّل",
                "bodyEn": "The referenced devices cover the permanent building. The temporary area added for this event is not covered by them and needs its own arrangement.",
                "bodyAr": "تغطي الأجهزة المُحال إليها المبنى الدائم. أما المنطقة المؤقتة المضافة لهذه الفعالية فغير مشمولة بها وتحتاج ترتيباً خاصاً بها.",
            },
        },
        "chips": {
            "referenced": {"en": "Referenced", "ar": "مُحال إليه"},
            "short": {"en": "Falls short", "ar": "دون المطلوب"},
        },
    },
}

path = OUT / "facility.json"
path.write_text(json.dumps(facility, ensure_ascii=False, indent=2) + "\n")
print(f"wrote {path.relative_to(OUT.parent.parent.parent)}")
