import type { SiteOption } from './event-site';

/**
 * Matching a typed query against the registered Facility/Sites, for the suggestions under
 * "Venue, route, or location" and the search in "Show all registered sites". Plain data in,
 * plain data out: no database, so the screen can import it.
 *
 * The suggestions match the name in either language and the Site ID; the full list's search
 * also matches the municipality. Matching only narrows a list -- it never links a site: the
 * link is made by choosing one, by Site ID.
 */
export function matchSites(
  options: readonly SiteOption[],
  query: string,
  { includeMunicipality = false }: { includeMunicipality?: boolean } = {},
): SiteOption[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...options];
  return options.filter((o) =>
    [o.nameEn, o.nameAr, o.id, ...(includeMunicipality ? [o.municipalityEn, o.municipalityAr] : [])].some((t) =>
      t.toLowerCase().includes(q),
    ),
  );
}

/** True while the location text still reads as the linked site's name, in either language. */
export function textNamesSite(text: string, site: Pick<SiteOption, 'nameEn' | 'nameAr'>): boolean {
  const t = text.trim();
  return t !== '' && (t === site.nameEn.trim() || t === site.nameAr.trim());
}
