# Level 3 medical plan responsibility correction

The owner's clarification applies to the **whole Event health and medical plan**, not just its major-incident section. This supersedes the narrower plan edit permissions described in the September 26 workflow note.

- Level 3: a confirmed Event Medical Director or EMS agency can prepare every section, upload a plan, update the checklist and read plan history. The same version conflict protection applies to both editors.
- The organizer can view the current plan, attachment and history, and remains responsible for filing the package. There are no plan editing/upload/save controls in the organizer's Level 3 view. Both server mutation paths refuse organizer writes, including crafted requests and old browser tabs.
- The requirements row says who completes the plan and offers View plan. The organizer's next-step panel no longer asks them to complete the Level 3 plan or upload the medical deployment map. Organizer-owned documents take priority in the requirements sequence.
- Level 1 and 2 plans remain organizer-editable. Level 2 major-incident preparedness remains optional.
- The Level 3 medical deployment map remains the Medical Director's responsibility, as separately requested. This correction does not change that rule.
- Access still requires a confirmed invitation to that event and the matching demo/real boundary. Removed partners cannot edit. No saved plan or history was deleted or rewritten.

English/Arabic responsibility labels: “Completed by the Medical Director or EMS agency.” / “يستكملها المدير الطبي أو جهة الإسعاف.” — shown for the organizer's Level 3 plan requirement.
“View plan” / “عرض الخطة” — organizer's Level 3 plan link.
“Medical documents pending” / “المستندات الطبية قيد الانتظار” — next step when only medical documents remain.

Validation: TypeScript and 469 unit/security/rule tests passed. Release browser checks cover both medical editors, stale-version refusal, attachment/history access, organizer read-only controls, lower-level behavior, and existing facility/event/venue workflows. Deployment and live checks are confirmed in the task response.
