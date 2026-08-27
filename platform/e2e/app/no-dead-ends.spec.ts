/**
 * THE DEAD-END PIN. A dead end is any row, panel, chip or counter that names
 * something outstanding where the role looking at it has NO control, NO named
 * owner, and NO stated wait. The administrator was that on every screen -- a
 * pending organization with no button -- and the shape kept recurring, so it is
 * now a failing state rather than a review finding.
 *
 * Mechanics: for every role, every screen, collect the leaf elements whose text
 * names an outstanding state (the marker vocabulary below), then walk up at most
 * five ancestors. The finding is ACCEPTABLE if any ancestor panel contains a
 * working control (button, link, input, summary), names another party as the
 * owner, or states the wait (a date, an "available from", a "you are notified").
 * Otherwise the test fails naming the role, the route and the text.
 *
 * The acceptors are deliberately STRICT counterparts of the definition -- when
 * this test fails, fix the screen, never loosen the matcher.
 */
import { expect, test, type Page } from '@playwright/test';

const MARKERS =
  /\b(outstanding|pending|awaiting|not yet|overdue|unanswered|owed|not set|incomplete|missing|blocked while|cannot be certified|awaiting recording|awaiting you|not recorded|not started|lapsed|lapsing|open —)\b/i;

const OWNERS =
  /(Ministry|organizer|Order of Physicians|Director|provider|operator|reviewer|inspector|named agenc|counterpart|المنظّم|الوزارة|النقابة|المدير|المزوّد|المشغّل|المراجع|المفتش)/i;

const WAITS =
  /(available from|opens|you are notified|notified when|until|by \d{4}|\d{4}-\d{2}-\d{2}|no due date until|before the event|after the event|when it is set|once the|بانتظار تسجيل|تُبلَّغون|يُفتح|بحلول|بعد أن|عند نشر)/i;

interface DeadEnd {
  route: string;
  text: string;
}

async function scan(page: Page, route: string): Promise<DeadEnd[]> {
  const response = await page.goto(route);
  if (!response || response.status() >= 400) return [];
  return page.evaluate(
    ({ markerSrc, ownerSrc, waitSrc }) => {
      const markers = new RegExp(markerSrc, 'i');
      const owners = new RegExp(ownerSrc, 'i');
      const waits = new RegExp(waitSrc, 'i');
      const out: { route: string; text: string }[] = [];
      const main = document.querySelector('main') ?? document.body;
      const leaves = Array.from(main.querySelectorAll('span, div, dt, dd, p, h2, h3')).filter(
        (el) => el.children.length === 0,
      );
      for (const leaf of leaves) {
        const text = (leaf.textContent ?? '').trim();
        // A chip, a counter, a row label -- not a prose sentence. The definition
        // targets marks of outstanding WORK; explanatory copy carries its own
        // context and is judged by the copy rules, not this scanner.
        if (text.length === 0 || text.length > 70) continue;
        if (!markers.test(text)) continue;
        // Walk up: is there a control, an owner, or a wait in the enclosing panel?
        let ok = false;
        let el: Element | null = leaf;
        for (let hop = 0; hop < 5 && el && el !== main; hop += 1) {
          const scopeText = (el.textContent ?? '').slice(0, 2500);
          if (el.querySelector('button, a[href], input, select, textarea, summary')) { ok = true; break; }
          if (owners.test(scopeText) || waits.test(scopeText)) { ok = true; break; }
          el = el.parentElement;
        }
        if (!ok) out.push({ route: location.pathname, text });
      }
      return out;
    },
    { markerSrc: MARKERS.source, ownerSrc: OWNERS.source, waitSrc: WAITS.source },
  );
}

async function signInAs(page: Page, login: string): Promise<void> {
  await page.goto('/signin');
  await page.locator(`form:has(input[value="${login}"]) button`).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/signin'));
}

const WALKS: { login: string; routes: string[] }[] = [
  {
    login: 'test_organizer',
    routes: [
      '/dashboard', '/organization', '/notifications',
      '/events/EV-0418', '/events/EV-0418/requirements', '/events/EV-0418/plan',
      '/events/EV-0418/submit', '/events/EV-0418/lifecycle', '/events/EV-0418/edit',
      '/events/EV-0362', '/events/EV-0362/submit',
      '/venues/VN-0032', '/venues/VN-0032/change',
      '/facilities/FC-0014', '/facilities/FC-0014/devices', '/facilities/FC-0014/plan',
    ],
  },
  { login: 'test_ems', routes: ['/dashboard', '/events/EV-0362/declaration', '/events/EV-0362/documents', '/profile'] },
  { login: 'test_director', routes: ['/dashboard', '/events/EV-0362', '/events/EV-0362/governance', '/events/EV-0362/report', '/credentials'] },
  { login: 'test_response', routes: ['/first-response/readiness'] },
  {
    login: 'test_moph',
    routes: [
      '/ministry', '/ministry/queue', '/ministry/submissions/EV-0362', '/ministry/submissions/EV-0455',
      '/ministry/changes', '/ministry/organizations', '/ministry/enquiries', '/ministry/incidents',
      '/ministry/facilities', '/ministry/facilities/arrests', '/ministry/applicability',
      '/ministry/determinations', '/ministry/order',
    ],
  },
  { login: 'test_inspector', routes: ['/ministry', '/ministry/submissions/EV-0362'] },
  { login: 'test_moph_admin', routes: ['/ministry', '/ministry/queue', '/ministry/submissions/EV-0362', '/ministry/organizations', '/ministry/enquiries', '/ministry/admin/users', '/ministry/admin/cardiac', '/ministry/admin/configuration', '/ministry/admin/registry'] },
  { login: 'test_owner', routes: ['/platform/admin', '/platform/activity'] },
];

test.describe('no dead ends', () => {
  for (const walk of WALKS) {
    test(`${walk.login} finds a control, an owner, or a wait behind every outstanding state`, async ({ page }) => {
      test.setTimeout(180_000);
      await signInAs(page, walk.login);
      const found: DeadEnd[] = [];
      for (const route of walk.routes) {
        found.push(...(await scan(page, route)));
      }
      expect(
        found.map((f) => `${f.route} :: "${f.text}"`),
        'Outstanding states with no control, no named owner and no stated wait. Fix the screen; never loosen the matcher.',
      ).toEqual([]);
    });
  }
});
