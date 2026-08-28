/**
 * Document storage. Plain TypeScript, like everything in lib/rules/.
 *
 * THE DEFERRED DECISION IS TAKEN (reviewer ruling, 2026-08-28): the platform
 * stores the file. Until now an attachment was a name and a date, and the review
 * screen said so in a line that has been removed. A reviewer who cannot open the
 * route map cannot review the route.
 *
 * What this module owns: whether an offered file is acceptable, and how an
 * accepted one is presented. What it deliberately does NOT own: who may read it.
 * Access is a role-and-ownership question answered at the serving route, against
 * the same rules every screen uses.
 *
 * ON SERVING UPLOADED BYTES. A file the platform stores and later serves inline
 * is a stored-XSS vector the moment the browser is allowed to decide what it is.
 * The accepted list is therefore an ALLOW-LIST, the served Content-Type comes
 * from that list rather than from the upload, and the route sends nosniff and a
 * sandbox policy. Nothing here trusts the client's declared type.
 */

import uploadsJson from './data/uploads.json';

export const UPLOADS_CONTENT = uploadsJson;

/**
 * The plan document is not in the attachment catalogue -- it is the plan itself --
 * so it travels under a reserved key. It lives here rather than in the route file
 * because Next treats a route module's exports as its own contract, and a constant
 * two screens import is not part of that contract.
 */
export const PLAN_DOC_KEY = 'plan-document';

export type InlineKind = 'frame' | 'image';

export interface AcceptedType {
  mime: string;
  ext: string;
  inline: InlineKind;
}

export interface UploadRefusal {
  reason: 'tooLarge' | 'wrongType' | 'empty';
  en: string;
  ar: string;
}

const ACCEPTED = uploadsJson.accepted as AcceptedType[];

/** The largest file the platform stores, in bytes. Configuration, never copy. */
export function maxUploadBytes(): number {
  return uploadsJson.maxBytes;
}

/** The `accept` attribute for a file input, built from the same allow-list. */
export function acceptAttribute(): string {
  return ACCEPTED.map((a) => a.mime).join(',');
}

/** The hint under a file picker, with the limit written in. */
export function acceptHint(): { en: string; ar: string } {
  return {
    en: uploadsJson.copy.acceptHintEn.replace('{max}', uploadsJson.maxBytesLabel),
    ar: uploadsJson.copy.acceptHintAr.replace('{max}', uploadsJson.maxBytesLabel),
  };
}

/**
 * The one place a stored MIME type becomes a served one. An unrecognised type is
 * never echoed back to the browser -- it is not served at all, because a type we
 * did not accept is a type we cannot vouch for.
 */
export function servedType(mime: string): AcceptedType | null {
  return ACCEPTED.find((a) => a.mime === mime) ?? null;
}

/**
 * Is this file acceptable? Returns null when it is, and a bilingual refusal
 * naming the actual problem when it is not. Size is checked against the stored
 * limit; type against the allow-list; emptiness separately, because "0 bytes" and
 * "too big" are different mistakes and the organizer should be told which.
 */
export function refuseUpload(file: { type: string; size: number }): UploadRefusal | null {
  if (file.size <= 0) {
    return { reason: 'empty', en: uploadsJson.copy.emptyEn, ar: uploadsJson.copy.emptyAr };
  }
  if (file.size > uploadsJson.maxBytes) {
    return {
      reason: 'tooLarge',
      en: uploadsJson.copy.tooLargeEn.replace('{max}', uploadsJson.maxBytesLabel),
      ar: uploadsJson.copy.tooLargeAr.replace('{max}', uploadsJson.maxBytesLabel),
    };
  }
  if (!servedType(file.type)) {
    return { reason: 'wrongType', en: uploadsJson.copy.wrongTypeEn, ar: uploadsJson.copy.wrongTypeAr };
  }
  return null;
}

/** A size a person can read, for the row beside a file name. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
