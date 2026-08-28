/**
 * A person's own words, quoted, with our punctuation outside theirs.
 *
 * Quoted regulation and quoted people are both verbatim in this build -- a decline
 * reason, a revision reason, a deficiency: the wording is theirs and is never
 * improved. The only thing this touches is the terminal full stop, because their
 * sentence usually ends in one and adding ours produced `...that weekend.".`
 *
 * IT LIVES IN lib/rules BECAUSE IT IS NEEDED TWICE. It was a private function in
 * app/actions.ts, and the revised-determination notification needed the same rule in
 * app/ministry-actions.ts. Two copies of a text rule is how the two notifications end
 * up punctuating a person's words differently.
 */
export function verbatimQuote(reason: string): string {
  const trimmed = reason.trimEnd();
  return /[.!?؟]$/.test(trimmed) ? trimmed.slice(0, -1) : trimmed;
}
