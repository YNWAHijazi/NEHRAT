/**
 * WHERE THE PACK LIVES.
 *
 * The reviewer's handoff pack -- prototypes, source documents and summaries -- is the
 * authority the build is checked against, and it gets replaced wholesale when the
 * reviewer revises it. Declared ONCE here so a replacement is a one-line change rather
 * than a hunt through scripts, tests and helpers.
 *
 * The directory name is the reviewer's; the build does not rename it.
 */
export const HANDOFF_PACK = 'handoff with updated pass';
