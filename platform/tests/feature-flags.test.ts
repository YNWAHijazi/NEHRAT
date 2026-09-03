/**
 * SPEC 2c: build the flags, ship them off, render nothing. All three assertions are
 * load-bearing: the flags exist (capability), every one is off (shipped off), and no
 * screen consults them yet (nothing rendered -- there is nothing to gate).
 *
 * Since the shape ruling (2026-09-02) this also pins the shape itself: the groups
 * partition the list exactly; the two AED regulatory capabilities are NOT flags (they
 * are Ministry powers under cardiac configuration); and the enable rule -- a
 * capability with no configuration cannot be enabled -- names what is missing.
 */

import { describe, expect, it } from 'vitest';
import flagsJson from '../lib/rules/data/feature-flags.json';
import ministryJson from '../lib/rules/data/ministry.json';
import {
  ALL_FLAGS,
  FLAG_GROUPS,
  featureEnabled,
  flagDetail,
  flagGroup,
  groupFlags,
  missingForEnable,
  type FeatureFlag,
} from '../lib/rules/flags';
import { filesUnder, read, relative } from './helpers/files';

const noChecks = { flagOn: () => false, checks: {} as Record<string, boolean> };

describe('commercial and AI capability', () => {
  // WIRED TO REAL DATA. A guard that sweeps an empty corpus finds no offenders and
  // reports green, and the green is indistinguishable from a clean codebase. This is
  // the fourth defect of that family (see tests/absence-is-anchored.test.ts for the
  // list), so every sweep now proves it swept something. filesUnder throws on a
  // missing directory; these floors catch the other half -- a corpus filtered down
  // to nothing by a renamed route or a wrong extension.
  it('sweeps the real source tree', () => {
    expect(
      [...filesUnder('app', ['.tsx', '.ts']), ...filesUnder('components', ['.tsx', '.ts'])].length,
    ).toBeGreaterThanOrEqual(90);
  });

  it('exists as flags', () => {
    for (const expected of [
      'applicationFees',
      'platformTransactionFees',
      'vendorDirectory',
      'sponsoredListings',
      'advertising',
      'aedPurchaseLinks',
      'aiAedIdentifierCapture',
      'aiUserReadinessAssistant',
      'aiReviewerAssistant',
      'aiPlatformIntelligenceAssistant',
    ]) {
      expect(ALL_FLAGS).toContain(expected);
    }
  });

  it('the two AED regulatory capabilities are not flags — they are Ministry powers', () => {
    // Moved to cardiac configuration by the shape ruling. Reappearing here would
    // put a regulatory power back in the platform owner's hands.
    expect(ALL_FLAGS).not.toContain('aedGeolocationRegistry');
    expect(ALL_FLAGS).not.toContain('aedAutomatedNotifications');
    const cardiacKeys = (
      ministryJson as unknown as { registryCapabilities: { items: { key: string }[] } }
    ).registryCapabilities.items.map((i) => i.key);
    expect(cardiacKeys).toEqual(['aedGeolocationRegistry', 'aedAutomatedNotifications']);
  });

  it('the groups partition the list exactly', () => {
    const grouped = FLAG_GROUPS.flatMap((g) => [...groupFlags(g)]);
    expect([...grouped].sort()).toEqual([...ALL_FLAGS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
    for (const flag of ALL_FLAGS) {
      expect(FLAG_GROUPS).toContain(flagGroup(flag));
    }
  });

  it('ships with every flag off', () => {
    for (const flag of ALL_FLAGS) {
      expect(featureEnabled(flag), `${flag} must ship off`).toBe(false);
    }
    expect(Object.values(flagsJson.flags).some(Boolean)).toBe(false);
  });

  it('renders nothing: no screen consults a flag while all are off', () => {
    const offenders = [
      ...filesUnder('app', ['.tsx', '.ts']),
      ...filesUnder('components', ['.tsx', '.ts']),
    ]
      .filter((f) => /featureEnabled|feature-flags|effectiveFlag/.test(read(f)))
      // The ADMINISTRATION surfaces are the exemption, pinned by name: their purpose
      // is to show and record the capability states. The list (FlagsPanel, rendered
      // on the owner console) carries no control; the capability's own page carries
      // the toggle and configuration; setFeatureFlagAction records the licensing
      // act. Administering a capability is not rendering the capability behind it.
      // A FIFTH file consulting a flag still fails here, which is the guard's whole
      // job. The Ministry configuration tab LEFT this list with the shape ruling:
      // no Ministry surface consults a flag any more.
      .filter((f) => !f.endsWith('app/platform/admin/page.tsx'))
      .filter((f) => !f.endsWith('app/platform/admin/capabilities/[flag]/page.tsx'))
      .filter((f) => !f.endsWith('components/FlagsPanel.tsx'))
      .filter((f) => !f.endsWith('app/ministry-actions.ts'))
      // The FIRST content consumer (application-fees commit): the service detail
      // fee line derives from the fee rule, whose off-state answer is the same
      // `Fee: None.` the page always carried -- e2e/app/public-landing.spec.ts
      // asserts it in the shipped state, e2e/app/capabilities.spec.ts asserts the
      // amount renders only while the capability is on. The submission-package
      // side reads the gate, not a flag, so it is not on this list.
      .filter((f) => !f.endsWith('app/services/[service]/page.tsx'))
      // The vendor directory (its commit): the public route answers not-found
      // while the capability is off, and the ONE operator-facing link is a single
      // component returning null while off -- the two operator screens render the
      // component and consult nothing, deliberately, so this list stays short.
      // e2e/app/capabilities.spec.ts walks off-absent and on-present for both.
      .filter((f) => !f.endsWith('app/vendors/page.tsx'))
      .filter((f) => !f.endsWith('components/VendorDirectoryLink.tsx'))
      // AED purchase links (its commit): one component, null unless BOTH the
      // purchase links and the directory they resolve to are on, and its only
      // destinations are listed directory vendors -- never an external address.
      .filter((f) => !f.endsWith('components/AedWhereToBuy.tsx'))
      // Advertising (its commit): the ONLY component that renders an advert,
      // keyed by the structural placement list; the test below pins which files
      // may mount it, which is what makes the placement list structural.
      .filter((f) => !f.endsWith('components/AdFooter.tsx'))
      // Registration fees (register closure, 2026-09-03): the venue's filing
      // moment names the amount due and holds the classification control; the
      // facility record carries the amount as a state, never a gate -- no
      // readiness obligation waits on money, and the band says so. Both render
      // nothing while the capability is off.
      .filter((f) => !f.endsWith('app/venues/[id]/assessment/page.tsx'))
      .filter((f) => !f.endsWith('app/facilities/[id]/page.tsx'))
      // ...and the venue gate ENFORCED server-side in the action, not only
      // rendered: the action recomputes rather than trusting the screen, the
      // same shape as the event filing gate.
      .filter((f) => !f.endsWith('app/actions.ts'))
      .map(relative);
    expect(
      offenders,
      'A screen consults a feature flag. With every flag off that can only mean commercial UI exists behind it -- which SPEC 2c forbids rendering.',
    ).toEqual([]);
  });
});

describe('the enable rule: a capability with no configuration cannot be enabled', () => {
  it('names every missing configuration field — conditional fields only when their condition holds', () => {
    const unconditional = flagDetail('applicationFees').requiredConfig.filter((f) => !f.requiredIf);
    const missing = missingForEnable('applicationFees', new Map(), noChecks);
    expect(missing.length).toBe(unconditional.length);
    expect(missing.every((m) => m.kind === 'field')).toBe(true);
    expect(missing[0]!.en).toContain('Currency');
    expect(missing[0]!.ar).toContain('العملة');
    // Varying by level makes the per-level fees required, and they are named.
    const varies = missingForEnable('applicationFees', new Map([['variesByLevel', 'yes']]), noChecks);
    expect(varies.some((m) => m.en.includes('Level 2'))).toBe(true);
    expect(varies.some((m) => m.en.includes('Level 3'))).toBe(true);
  });

  it('clears when every field holds a value — zero is a value', () => {
    const stored = new Map(
      flagDetail('applicationFees').requiredConfig.map((f) => [f.key, f.kind === 'number' ? '0' : 'USD']),
    );
    expect(missingForEnable('applicationFees', stored, noChecks)).toEqual([]);
  });

  it('an empty string is not a value', () => {
    const stored = new Map(flagDetail('platformTransactionFees').requiredConfig.map((f) => [f.key, '  ']));
    const missing = missingForEnable('platformTransactionFees', stored, noChecks);
    expect(missing.length).toBe(2);
  });

  it('a dependency that is off blocks, naming the dependency', () => {
    for (const flag of ['sponsoredListings', 'aedPurchaseLinks'] as FeatureFlag[]) {
      expect(flagDetail(flag).dependsOn).toBe('vendorDirectory');
      const off = missingForEnable(flag, new Map(), noChecks);
      expect(off.some((m) => m.kind === 'dependency' && m.en.includes('Vendor directory'))).toBe(true);
      const on = missingForEnable(flag, new Map(), { flagOn: () => true, checks: {} });
      expect(on.some((m) => m.kind === 'dependency')).toBe(false);
    }
  });

  it('sponsored listings needs both its dependency and a sponsorship in period', () => {
    const d = flagDetail('sponsoredListings');
    expect(d.dependsOn).toBe('vendorDirectory');
    expect(d.requiredChecks?.map((c) => c.key)).toEqual(['activeSponsorship']);
    const bothMissing = missingForEnable('sponsoredListings', new Map(), noChecks);
    expect(bothMissing.map((m) => m.kind)).toEqual(['dependency', 'check']);
    const checkOnly = missingForEnable('sponsoredListings', new Map(), { flagOn: () => true, checks: {} });
    expect(checkOnly).toEqual([expect.objectContaining({ kind: 'check', en: expect.stringContaining('sponsorship in period') })]);
    expect(missingForEnable('sponsoredListings', new Map(), { flagOn: () => true, checks: { activeSponsorship: true } })).toEqual([]);
  });

  it('a readiness check that is not met blocks, named', () => {
    const missing = missingForEnable('vendorDirectory', new Map(), noChecks);
    expect(missing).toEqual([
      expect.objectContaining({ kind: 'check', en: expect.stringContaining('listed vendor') }),
    ]);
    expect(missingForEnable('vendorDirectory', new Map(), { flagOn: () => false, checks: { listedVendor: true } })).toEqual([]);
  });

  it('the platform intelligence assistant is blocked by an unmade decision, and configuration does not unblock it', () => {
    const fullConfig = new Map(
      flagDetail('aiPlatformIntelligenceAssistant').requiredConfig.map((f) => [f.key, f.kind === 'number' ? '100' : (f.options?.[0] ?? 'x')]),
    );
    const missing = missingForEnable('aiPlatformIntelligenceAssistant', fullConfig, { flagOn: () => true, checks: {} });
    expect(missing).toEqual([expect.objectContaining({ kind: 'decision' })]);
    // Both readings named, neither resolved: the page surfaces the contradiction.
    expect(missing[0]!.en).toMatch(/full tenant visibility/);
    expect(missing[0]!.en).toMatch(/counts only/);
  });

  it('every assistive capability requires a model, a data reach, a confirmation setting and a spend ceiling', () => {
    for (const flag of groupFlags('assistive')) {
      const keys = flagDetail(flag).requiredConfig.map((f) => f.key);
      expect(keys).toEqual(['model', 'dataScope', 'humanConfirm', 'monthlyCeilingUsd', 'onCeiling']);
    }
  });

  it('the vendor directory carries the regulation’s five categories and the disclaimer, bilingually', async () => {
    const { vendorCategories, vendorDisclaimer } = await import('../lib/rules/flags');
    expect(vendorCategories().map((c) => c.key)).toEqual([
      'defibrillatorSupply',
      'padsAndBatteries',
      'ambulanceServices',
      'resuscitationTraining',
      'eventMedicalCover',
    ]);
    for (const c of vendorCategories()) {
      expect(c.en.trim().length).toBeGreaterThan(0);
      expect(c.ar.trim().length).toBeGreaterThan(0);
    }
    expect(vendorDisclaimer().en).toBe('Listing is commercial and is not Ministry endorsement.');
    expect(vendorDisclaimer().ar.trim().length).toBeGreaterThan(0);
  });

  it('the placement list is structural: adverts mount only at the foot of the named public pages', async () => {
    const { adPlacements, adLabel } = await import('../lib/rules/flags');
    // The list itself: three public feet, bilingual, and the label that every
    // advert carries.
    expect(adPlacements().map((p) => p.key)).toEqual(['publicLanding', 'serviceDetail', 'vendorDirectory']);
    expect(adLabel().en).toBe('Advertisement');
    expect(adLabel().ar.trim().length).toBeGreaterThan(0);

    // WHO MAY MOUNT THE COMPONENT, pinned exactly. A new mount is a code change
    // that fails here and must justify itself against the constraint: the foot
    // of a public page, never a screen where someone is filing, reviewing or
    // reporting an incident. This is what "structural, not a guideline" means.
    const mounts = [...filesUnder('app', ['.tsx', '.ts']), ...filesUnder('components', ['.tsx', '.ts'])]
      .filter((f) => !f.endsWith('components/AdFooter.tsx'))
      .filter((f) => /AdFooter/.test(read(f)))
      .map(relative)
      .sort();
    expect(mounts).toEqual(['app/page.tsx', 'app/services/[service]/page.tsx', 'app/vendors/page.tsx']);
    // And none of those is a filing, reviewing or reporting surface.
    for (const f of mounts) {
      expect(/app\/(events|ministry|facilities|venues|platform)\//.test(f), `${f} must be a public surface`).toBe(false);
    }
  });

  it('the assistants are deliberately not built, and the statement says so in both languages', async () => {
    const { assistiveNotBuilt } = await import('../lib/rules/flags');
    expect(assistiveNotBuilt().en).toContain('deliberately not built');
    expect(assistiveNotBuilt().en).toContain('activates nothing until the assistant is built');
    expect(assistiveNotBuilt().ar).toContain('غير مبني عمداً');
  });

  it('every capability page carries bilingual title, description and detail', () => {
    for (const flag of ALL_FLAGS) {
      const d = flagDetail(flag);
      for (const s of [d.titleEn, d.titleAr, d.whatEn, d.whatAr]) {
        expect(s.trim().length, `${flag} detail strings`).toBeGreaterThan(0);
      }
      for (const f of d.requiredConfig) {
        expect(f.labelEn.trim().length).toBeGreaterThan(0);
        expect(f.labelAr.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
