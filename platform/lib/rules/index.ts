/**
 * The derivation and gating module.
 *
 * Plain TypeScript. No React, no next/*, no server-only imports. Every screen asks this
 * module rather than deciding for itself -- if two screens disagree about whether
 * something is available, this is the only place to fix it.
 */

export * from './types';
export * from './load';
export * from './predicate';
export * from './derive';
export * from './deadlines';
export * from './scope';
export * from './public-lookup';
export * from './gates';
export * from './flags';
export * from './requirements';
export * from './submission';
export * from './content';
export * from './facility';
export * from './pii';
export * from './roles';
export * from './ministry';
export * from './attestations';
export * from './uploads';
export * from './nomination-access';
export * from './accounts';
export * from './bilingual-map';
export * from './certification';
export * from './verbatim';
