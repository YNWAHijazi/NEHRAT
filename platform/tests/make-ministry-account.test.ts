/**
 * The account script duplicates the app's scrypt parameters, because a plain .mjs
 * cannot resolve lib/rules' extensionless imports. Duplication of a security primitive
 * is exactly what drifts silently, so it is held here: hash with the SCRIPT, verify
 * with the APP. If the app's key length or salt:hash format ever changes, this fails
 * rather than the script quietly minting accounts nobody can sign in to.
 */

import { describe, expect, it } from 'vitest';
// @ts-expect-error -- a .mjs dev script, deliberately not part of the typed build.
import { hashPasswordLikeTheApp, generatePassword } from '../scripts/make-ministry-account.mjs';
import { verifyPassword, checkPasswordPolicy } from '../lib/password';

describe('the Ministry account script', () => {
  it('produces a hash the application accepts', () => {
    const password = 'A-test-password-9!';
    const stored = hashPasswordLikeTheApp(password) as string;
    expect(verifyPassword(password, stored)).toBe(true);
    expect(verifyPassword('the wrong password', stored)).toBe(false);
  });

  it('salts, so the same password never hashes twice the same', () => {
    const a = hashPasswordLikeTheApp('same input') as string;
    const b = hashPasswordLikeTheApp('same input') as string;
    expect(a).not.toBe(b);
    expect(verifyPassword('same input', a)).toBe(true);
    expect(verifyPassword('same input', b)).toBe(true);
  });

  it('generates passwords that satisfy the configured policy', () => {
    for (let i = 0; i < 25; i += 1) {
      const p = generatePassword() as string;
      expect(p.length).toBe(20);
      expect(checkPasswordPolicy(p).ok, `${p} failed the policy`).toBe(true);
      // Stricter than the review build's placeholder, so tightening auth-policy.json
      // does not silently start producing passwords the app would reject.
      expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)).toBe(true);
    }
  });
});
