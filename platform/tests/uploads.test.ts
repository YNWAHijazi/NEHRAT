/**
 * Document storage: what the platform accepts, and what it will serve.
 *
 * The security-relevant assertion in this file is the last one. Everything else
 * is acceptance policy; that one is the reason the served type never comes from
 * the upload.
 */
import { describe, expect, it } from 'vitest';
import {
  PLAN_DOC_KEY,
  UPLOADS_CONTENT,
  acceptAttribute,
  acceptHint,
  humanSize,
  maxUploadBytes,
  refuseUpload,
  servedType,
} from '../lib/rules/uploads';

describe('what the platform accepts', () => {
  it('accepts a PDF within the limit', () => {
    expect(refuseUpload({ type: 'application/pdf', size: 1024 })).toBeNull();
  });

  it('names the three refusals separately -- "invalid" tells the organizer nothing', () => {
    expect(refuseUpload({ type: 'application/pdf', size: 0 })?.reason).toBe('empty');
    expect(refuseUpload({ type: 'application/pdf', size: maxUploadBytes() + 1 })?.reason).toBe('tooLarge');
    expect(refuseUpload({ type: 'text/html', size: 10 })?.reason).toBe('wrongType');
  });

  it('carries both languages on every refusal', () => {
    for (const file of [
      { type: 'application/pdf', size: 0 },
      { type: 'application/pdf', size: maxUploadBytes() + 1 },
      { type: 'text/html', size: 10 },
    ]) {
      const refusal = refuseUpload(file);
      expect(refusal?.en.length, `${file.type} en`).toBeGreaterThan(0);
      expect(refusal?.ar.length, `${file.type} ar`).toBeGreaterThan(0);
    }
  });

  it('accepts exactly at the limit and refuses one byte past it', () => {
    expect(refuseUpload({ type: 'image/png', size: maxUploadBytes() })).toBeNull();
    expect(refuseUpload({ type: 'image/png', size: maxUploadBytes() + 1 })).not.toBeNull();
  });

  it('writes the limit into the copy rather than hard-coding a number in a sentence', () => {
    expect(acceptHint().en).toContain(UPLOADS_CONTENT.maxBytesLabel);
    expect(acceptHint().ar).toContain(UPLOADS_CONTENT.maxBytesLabel);
    expect(acceptHint().en).not.toContain('{max}');
    expect(acceptHint().ar).not.toContain('{max}');
  });

  it('builds the picker accept attribute from the same allow-list it enforces', () => {
    for (const mime of acceptAttribute().split(',')) {
      expect(refuseUpload({ type: mime, size: 100 }), mime).toBeNull();
    }
  });

  it('gives the plan document a reserved key that is not an attachment key', () => {
    expect(PLAN_DOC_KEY).toBe('plan-document');
  });

  it('reads sizes for a person', () => {
    expect(humanSize(512)).toBe('512 B');
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('what the platform will serve', () => {
  it('refuses to vouch for a type it did not accept -- the stored-XSS gate', () => {
    // The serving route sends servedType()'s mime, never the stored string. A row
    // whose content_type is text/html or image/svg+xml resolves to null here and
    // is therefore not served at all. If this assertion is ever loosened, an
    // organizer can put script on the Ministry's own origin, inside a reviewer's
    // authenticated session, by naming their upload a route map.
    for (const dangerous of [
      'text/html',
      'image/svg+xml',
      'application/xhtml+xml',
      'text/xml',
      'application/javascript',
      '',
    ]) {
      expect(servedType(dangerous), dangerous).toBeNull();
    }
  });

  it('resolves each accepted type to a mime it chose and a way to show it', () => {
    for (const accepted of UPLOADS_CONTENT.accepted) {
      const served = servedType(accepted.mime);
      expect(served?.mime).toBe(accepted.mime);
      expect(['frame', 'image']).toContain(served?.inline);
    }
  });
});
