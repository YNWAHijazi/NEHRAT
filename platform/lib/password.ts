/**
 * Password hashing: scrypt from node:crypto, no dependency. Stored as salt:hash, hex.
 *
 * The POLICY (length, character classes, expiry) is data in
 * lib/rules/data/auth-policy.json -- a Ministry decision pending; changing it changes
 * no code here.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AUTH_POLICY } from './rules';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuf = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}

export interface PolicyCheck {
  ok: boolean;
  /** Which configured rule failed, for a message key -- never the password itself. */
  failed?: 'minLength' | 'requireUppercase' | 'requireDigit' | 'requireSymbol';
}

export function checkPasswordPolicy(password: string): PolicyCheck {
  const p = AUTH_POLICY.password;
  if (password.length < p.minLength) return { ok: false, failed: 'minLength' };
  if (p.requireUppercase && !/[A-Z]/.test(password)) return { ok: false, failed: 'requireUppercase' };
  if (p.requireDigit && !/\d/.test(password)) return { ok: false, failed: 'requireDigit' };
  if (p.requireSymbol && !/[^A-Za-z0-9]/.test(password)) return { ok: false, failed: 'requireSymbol' };
  return { ok: true };
}

export const RESET_EXPIRY_MINUTES: number = AUTH_POLICY.reset.linkExpiryMinutes;

/**
 * An activation link's window. Longer than a reset's by design: a reset answers
 * somebody at their keyboard now, an activation reaches somebody who has just been
 * told an account exists for them. An hour would expire before it arrived.
 */
export const ACTIVATION_EXPIRY_HOURS: number = AUTH_POLICY.reset.activationExpiryHours;
