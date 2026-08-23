/**
 * The bilingual primitive. Renders both languages; CSS on html[lang] shows one.
 *
 * This is the reference prototypes' own mechanism (data-l spans), kept because it makes
 * language switching instant, keeps the DOM identical to the reference for the visual
 * comparison, and -- the real point -- makes parity mechanical: `en` and `ar` are
 * REQUIRED props, so a string missing its Arabic fails to compile, not to render.
 */

export function L({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span data-l="en">{en}</span>
      <span data-l="ar">{ar}</span>
    </>
  );
}
