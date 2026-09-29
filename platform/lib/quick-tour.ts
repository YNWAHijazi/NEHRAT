/** Short dashboard guidance. These explain existing actions; they grant no permissions. */
export type TourStep = { title: { en: string; ar: string }; body: { en: string; ar: string }; target?: string | undefined };
const step = (en: string, ar: string, bodyEn: string, bodyAr: string, target?: string): TourStep => ({ title: { en, ar }, body: { en: bodyEn, ar: bodyAr }, target });
export function quickTourSteps(role: string): TourStep[] {
  const welcome = step('A quick look around', 'جولة سريعة', 'See where to start and how to follow your work. You can skip this tour at any time.', 'تعرّف على نقطة البداية وكيفية متابعة عملك. يمكنك تخطّي الجولة في أي وقت.');
  const notifications = step('Check for updates', 'تابع المستجدات', 'Open notifications to see invitations, replies and updates.', 'افتح الإشعارات للاطلاع على الدعوات والردود والمستجدات.', '[data-tour="notifications"]');
  const account = step('Your account', 'حسابك', 'Use this menu to sign out or open this tour again.', 'استخدم هذه القائمة لتسجيل الخروج أو فتح الجولة مجدداً.', '[data-tour="account"]');
  const organizer = [
    step('Start a service', 'ابدأ خدمة', 'Choose an event, a hosting venue or a facility. Enter the details to see what you need to provide.', 'اختر فعالية أو موقع استضافة أو منشأة. أدخل التفاصيل لتظهر المتطلبات.', '[data-service-picker] > button'),
    step('Complete your requirements', 'أكمل متطلباتك', 'Add your files and invite your medical team. If a medical plan is needed, the EMS agency or Medical Director fills it in. You can read their answers.', 'أضف ملفاتك وادعُ فريقك الطبي. عند الحاجة إلى خطة طبية، تُعدّها جهة الإسعاف أو المدير الطبي. يمكنك الاطلاع على إجاباتهم.'),
    step('Submit and follow up', 'قدّم الطلب وتابعه', 'Review your completed requirements, then submit. Open your record to follow Ministry updates and download your certificate when it is issued.', 'راجع المتطلبات المكتملة ثم قدّم الطلب. افتح سجلك لمتابعة مستجدات الوزارة وتنزيل الشهادة عند إصدارها.'),
  ];
  const medical = [
    step('Open an event', 'افتح فعالية', 'Your invitations and tasks appear here. Open an event, check the details and respond to the invitation.', 'تظهر هنا دعواتك ومهامك. افتح الفعالية وراجع التفاصيل ثم أجب عن الدعوة.', '[data-region="outstanding"]'),
    step('Complete your part', 'أكمل دورك', role === 'ems' ? 'After you accept, add your staffing and coverage details. The organizer can see what you share.' : 'After you accept, open your tasks and add the medical arrangements. The organizer can see what you share.', role === 'ems' ? 'بعد قبول الدعوة، أضف تفاصيل فريقك والتغطية الإسعافية. يمكن للمنظّم الاطلاع على ما تشاركه.' : 'بعد قبول الدعوة، افتح مهامك وأضف الترتيبات الطبية. يمكن للمنظّم الاطلاع على ما تشاركه.'),
    step('One shared medical plan', 'خطة طبية واحدة مشتركة', 'If a plan is needed, either the EMS agency or Medical Director can complete it. Both see the same plan. The organizer reviews it before submitting.', 'عند الحاجة إلى خطة، يمكن لجهة الإسعاف أو المدير الطبي إكمالها. يشاهد الطرفان الخطة نفسها، ويطّلع عليها المنظّم قبل التقديم.'),
  ];
  const ministry = [
    step('Choose a service', 'اختر خدمة', 'Switch between events, hosting venues and facilities.', 'انتقل بين الفعاليات ومواقع الاستضافة والمنشآت.', '[data-tour="services"]'),
    step('Open a file to review', 'افتح ملفاً للمراجعة', 'Choose a submission to see its details, files and medical-team answers. Record your review and any changes needed.', 'اختر طلباً للاطلاع على تفاصيله وملفاته وإجابات الفريق الطبي. سجّل المراجعة وأي تعديلات مطلوبة.', '[data-region="counters"]'),
  ];
  const owner = [
    step('Manage the platform', 'إدارة المنصة', 'Manage users and roles, change settings, and check activity and records here.', 'أدر المستخدمين والأدوار وعدّل الإعدادات وراجع النشاط والسجلات من هنا.', '[data-region="owner-admin-links"]'),
    step('Check your services', 'راجع خدماتك', 'See user and record totals. Open a service or setting to manage it.', 'اطّلع على أعداد المستخدمين والسجلات. افتح الخدمة أو الإعداد لإدارته.', '[data-region="owner-overview"]'),
  ];
  const order = [step('Review referred events', 'راجع الفعاليات المحالة', 'Open an assigned event to read the file and record your review.', 'افتح فعالية مسندة إليك للاطلاع على الملف وتسجيل مراجعتك.', 'main h1')];
  return [welcome, ...(role === 'organizer' ? organizer : role === 'ems' || role === 'director' ? medical : role === 'platform_owner' ? owner : role === 'order' ? order : ministry), notifications, account];
}
