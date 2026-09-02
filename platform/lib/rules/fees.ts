/**
 * Application fees -- the rule, not the money. Whether a fee is in force, how
 * much, and what the public line says, derived from the capability's stored
 * configuration. Pure: the caller passes the effective flag state and the
 * per-field configuration; a screen, the filing gate and a test read one rule.
 *
 * A fee of zero is a configured answer meaning no amount is due, and the line
 * stays `Fee: None.` -- never "free" (non-negotiable 12). An unparseable or
 * missing amount is UNSET, not zero: nothing is due and nothing renders,
 * because the enable rule should have refused the state that produced it.
 */

import type { Level } from './types';

export type FeeService = 'certifyEvent' | 'registerVenue' | 'registerFacility';

export interface ApplicationFee {
  /** The configured amount, verbatim -- money is not floated through arithmetic. */
  amount: string;
  currency: string;
}

const FEE_KEY: Record<FeeService, string> = {
  certifyEvent: 'feeCertifyEvent',
  registerVenue: 'feeRegisterVenue',
  registerFacility: 'feeRegisterFacility',
};

function parsedAmount(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return raw.trim();
}

/**
 * The fee in force for one service, or null when none is: capability off,
 * configuration unset, or a configured zero. For an event whose fee varies by
 * level, the level picks the per-level amount -- and an event with NO derived
 * level yet owes the fee it cannot yet know, so the caller passes null and
 * gets the Level 1 base with `variesByLevel` returned true so the screen can
 * say the amount may change with the level.
 */
export function applicationFee(
  service: FeeService,
  level: Level | null,
  enabled: boolean,
  config: ReadonlyMap<string, string>,
): (ApplicationFee & { variesByLevel: boolean }) | null {
  if (!enabled) return null;
  const currency = config.get('currency')?.trim();
  if (!currency) return null;
  const varies = service === 'certifyEvent' && config.get('variesByLevel') === 'yes';
  let amount = parsedAmount(config.get(FEE_KEY[service]));
  if (varies && level === 2) amount = parsedAmount(config.get('feeCertifyEventL2'));
  if (varies && level === 3) amount = parsedAmount(config.get('feeCertifyEventL3'));
  if (amount === null) return null;
  return { amount, currency, variesByLevel: varies };
}

/**
 * The public service-detail line(s). One `Fee: None.` line while no fee is in
 * force; with a fee, the amount -- per level where it varies, because a page
 * that says one number for a fee that is three is wrong for two of them.
 */
export function serviceFeeLines(
  service: FeeService,
  enabled: boolean,
  config: ReadonlyMap<string, string>,
): { en: string; ar: string }[] {
  const base = applicationFee(service, null, enabled, config);
  if (base === null) return [{ en: 'Fee: None.', ar: 'الرسم: لا يوجد.' }];
  if (!base.variesByLevel) {
    return [{ en: `Fee: ${base.amount} ${base.currency}.`, ar: `الرسم: ${base.amount} ${base.currency}.` }];
  }
  return ([1, 2, 3] as Level[]).map((l) => {
    const f = applicationFee(service, l, enabled, config);
    return f === null
      ? { en: `Fee, Level ${l}: None.`, ar: `الرسم، المستوى ${l}: لا يوجد.` }
      : { en: `Fee, Level ${l}: ${f.amount} ${f.currency}.`, ar: `الرسم، المستوى ${l}: ${f.amount} ${f.currency}.` };
  });
}
