/**
 * Application fees: the fee derives from the capability's configuration, the
 * public line never says "free", and the filing gate holds the state between
 * complete and filed -- awaiting payment -- only when the fee blocker stands
 * alone. The payment seam is the single write, and a recorded payment
 * discharges the fee.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applicationFee,
  documentsForLevel,
  nextAction,
  serviceFeeLines,
  submissionGate,
  type SubmissionFacts,
} from '../lib/rules';

const CONFIG = new Map([
  ['currency', 'USD'],
  ['feeCertifyEvent', '100'],
  ['feeRegisterVenue', '50'],
  ['feeRegisterFacility', '0'],
  ['variesByLevel', 'no'],
]);

describe('the fee rule', () => {
  it('no fee is in force while the capability is off -- the shipped state', () => {
    expect(applicationFee('certifyEvent', 1, false, CONFIG)).toBeNull();
    expect(serviceFeeLines('certifyEvent', false, CONFIG)).toEqual([{ en: 'Fee: None.', ar: 'الرسم: لا يوجد.' }]);
  });

  it('a configured zero is a configured answer: no amount due, and the line stays Fee: None.', () => {
    expect(applicationFee('registerFacility', null, true, CONFIG)).toBeNull();
    expect(serviceFeeLines('registerFacility', true, CONFIG)[0]!.en).toBe('Fee: None.');
  });

  it('a fee in force renders the amount, verbatim, never the word free', () => {
    const fee = applicationFee('certifyEvent', 1, true, CONFIG);
    expect(fee).toEqual({ amount: '100', currency: 'USD', variesByLevel: false });
    const lines = serviceFeeLines('certifyEvent', true, CONFIG);
    expect(lines).toEqual([{ en: 'Fee: 100 USD.', ar: 'الرسم: 100 USD.' }]);
    for (const l of lines) expect(l.en.toLowerCase()).not.toContain('free');
  });

  it('varying by level picks the per-level amount, and the public page states all three', () => {
    const varies = new Map([...CONFIG, ['variesByLevel', 'yes'], ['feeCertifyEventL2', '200'], ['feeCertifyEventL3', '300']]);
    expect(applicationFee('certifyEvent', 1, true, varies)?.amount).toBe('100');
    expect(applicationFee('certifyEvent', 2, true, varies)?.amount).toBe('200');
    expect(applicationFee('certifyEvent', 3, true, varies)?.amount).toBe('300');
    const lines = serviceFeeLines('certifyEvent', true, varies);
    expect(lines.map((l) => l.en)).toEqual(['Fee, Level 1: 100 USD.', 'Fee, Level 2: 200 USD.', 'Fee, Level 3: 300 USD.']);
  });

  it('unset configuration means nothing is due -- unset is not zero, and neither renders an amount', () => {
    expect(applicationFee('certifyEvent', 1, true, new Map())).toBeNull();
    expect(applicationFee('certifyEvent', 1, true, new Map([['currency', 'USD']]))).toBeNull();
  });
});

/** A Level 1 package with everything the level requires in place. */
function completeFacts(fee: SubmissionFacts['fee']): SubmissionFacts {
  return {
    level: 1,
    organizationStatus: 'recorded',
    documentState: Object.fromEntries(documentsForLevel(1).map((d) => [d.key, true])),
    certification: { representative: 'R', telephone: '01', position: 'P' },
    grandfather: { today: '2026-09-02', filedAt: null, determined: false },
    providers: [],
    director: null,
    declarationsComplete: true,
    today: '2026-09-02',
    filingDeadline: null,
    fee,
  };
}

describe('the filing gate and the state between complete and filed', () => {
  it('no fee in force: the gate is untouched', () => {
    const gate = submissionGate(completeFacts(null));
    expect(gate.canFile).toBe(true);
    expect(gate.awaitingPayment).toBe(false);
  });

  it('an unpaid fee blocks filing, named with the amount, and the complete package is awaiting payment', () => {
    const gate = submissionGate(completeFacts({ amount: '100', currency: 'USD', paid: false }));
    expect(gate.canFile).toBe(false);
    expect(gate.blockers).toEqual([
      expect.objectContaining({ kind: 'feeUnpaid', itemEn: 'Application fee — awaiting payment: 100 USD' }),
    ]);
    expect(gate.awaitingPayment).toBe(true);
    expect(nextAction(gate.blockers).kind).toBe('awaitingPayment');
  });

  it('an incomplete package is NOT awaiting payment -- the fee queues behind the organizer’s own work', () => {
    const facts = completeFacts({ amount: '100', currency: 'USD', paid: false });
    facts.declarationsComplete = false;
    const gate = submissionGate(facts);
    expect(gate.awaitingPayment).toBe(false);
    expect(gate.blockers.length).toBe(2);
    expect(nextAction(gate.blockers).kind).toBe('declarations');
  });

  it('a recorded payment discharges the fee and the gate opens', () => {
    const gate = submissionGate(completeFacts({ amount: '100', currency: 'USD', paid: true }));
    expect(gate.canFile).toBe(true);
    expect(gate.awaitingPayment).toBe(false);
  });
});

describe('the payment seam', () => {
  const DB_PATH = join(tmpdir(), `nehrat-payments-${process.pid}.db`);

  beforeAll(() => {
    process.env['DATABASE_PATH'] = DB_PATH;
  });

  afterAll(() => {
    rmSync(DB_PATH, { force: true });
    rmSync(`${DB_PATH}-wal`, { force: true });
    rmSync(`${DB_PATH}-shm`, { force: true });
  });

  it('recordPaymentReceived is the single write, and paymentFor reads it back', async () => {
    const { recordPaymentReceived, paymentFor } = await import('../lib/payments');
    expect(paymentFor('EV-9999', 'certifyEvent')).toBeNull();
    recordPaymentReceived({
      recordId: 'EV-9999',
      service: 'certifyEvent',
      amount: '100',
      currency: 'USD',
      provider: 'test-provider',
      providerReference: 'ref-1',
    });
    const paid = paymentFor('EV-9999', 'certifyEvent');
    expect(paid).not.toBeNull();
    expect(paid?.amount).toBe('100');
    expect(paid?.provider).toBe('test-provider');
    // The payment discharges ITS service on ITS record, nothing else.
    expect(paymentFor('EV-9999', 'registerVenue')).toBeNull();
    expect(paymentFor('EV-9998', 'certifyEvent')).toBeNull();
  });
});
