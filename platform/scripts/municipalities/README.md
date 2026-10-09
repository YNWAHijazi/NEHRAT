# Municipality list

Rebuilds `lib/rules/data/municipalities.json` from the owner's governorate PDFs (9 October 2026).
Run each step with `python3 -I`; the PDFs are untrusted input, so keep them in their own folder.

1. `pdftotext -layout <file>.pdf <file>.txt` for each PDF, then `1_parse.py <txt folder> rows.json`: one row per municipality and district.
2. `2_clean.py rows.json built.json`: restores the files' reversed word order, joins the wrapped name, reduces the scraped sentence to its name, drops the double row, adds Beirut.
3. `3_correct.py built.json fixed.json`: common district spellings, main towns under their common names (the files' spellings kept as aliases), the clear errors, and the main municipalities the files lack.

Copy `corrections` and `municipalities` from `fixed.json` into the data file, keeping its `$comment`.
The Arabic names are pending; when they arrive, add `ar` (and `districtAr`) per entry and remove the parity exclusion in `tests/bilingual-parity.test.ts`.
