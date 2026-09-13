/** CSV fields are always quoted. Neutralize formulas in user-entered text. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvDocument(rows: (string | number | boolean | null | undefined)[][]): string {
  // UTF-8 BOM preserves Arabic in spreadsheet applications.
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
