import type { HostingVenueOption } from './hosting-venues';

/**
 * Matching a typed query against the registered venues, for the suggestions under
 * "Venue, route, or location" and the search in "Show all registered venues". Plain
 * data in, plain data out: no database, so the screen can import it.
 *
 * The suggestions match the name in either language and the record id (platform owner,
 * 8 October 2026). The full list's search also matches the district, as the fixed-venue
 * selector's search already does. Matching only narrows a list -- it never links a
 * venue: the link is made by choosing one, by record id.
 */
export function matchHostingVenues(
  options: readonly HostingVenueOption[],
  query: string,
  { includeDistrict = false }: { includeDistrict?: boolean } = {},
): HostingVenueOption[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...options];
  return options.filter((o) =>
    [o.nameEn, o.nameAr, o.id, ...(includeDistrict ? [o.districtEn, o.districtAr] : [])].some((t) =>
      t.toLowerCase().includes(q),
    ),
  );
}

/** True while the location text still reads as the linked venue's name, in either language. */
export function textNamesVenue(text: string, venue: Pick<HostingVenueOption, 'nameEn' | 'nameAr'>): boolean {
  const t = text.trim();
  return t !== '' && (t === venue.nameEn.trim() || t === venue.nameAr.trim());
}
