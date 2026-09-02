/**
 * THE PAYMENT PROVIDER SEAM. The platform defines where money is owed (the fee
 * rule), where its receipt is recorded (here), and what receipt unlocks (the
 * filing gate). It does not define HOW money moves: no provider is integrated,
 * deliberately -- that is a procurement decision, not a build decision. When
 * one is chosen, its callback lands on recordPaymentReceived and nothing else
 * changes.
 *
 * Until then a submission with a fee in force sits at awaiting payment. That is
 * the true state, and the screen says so rather than pretending a channel
 * exists.
 */

import { getDb } from './db';
import type { FeeService } from './rules';

export interface PaymentReceipt {
  recordId: string;
  service: FeeService;
  amount: string;
  currency: string;
  provider: string;
  providerReference: string;
}

/** The single write. A provider integration calls this and only this. */
export function recordPaymentReceived(receipt: PaymentReceipt): void {
  getDb()
    .prepare(
      `INSERT INTO payments (record_id, service, amount, currency, provider, provider_reference, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, now_stamp())`,
    )
    .run(receipt.recordId, receipt.service, receipt.amount, receipt.currency, receipt.provider, receipt.providerReference);
}

export interface PaymentRow {
  amount: string;
  currency: string;
  provider: string;
  paidAt: string;
}

/** The recorded payment discharging this record's fee, or null while none is. */
export function paymentFor(recordId: string, service: FeeService): PaymentRow | null {
  const row = getDb()
    .prepare(
      `SELECT amount, currency, provider, paid_at FROM payments
       WHERE record_id = ? AND service = ? ORDER BY paid_at DESC, id DESC LIMIT 1`,
    )
    .get(recordId, service) as { amount: string; currency: string; provider: string; paid_at: string } | undefined;
  if (!row) return null;
  return { amount: row.amount, currency: row.currency, provider: row.provider, paidAt: row.paid_at.slice(0, 10) };
}
