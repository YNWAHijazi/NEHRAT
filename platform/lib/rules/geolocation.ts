/** Coordinates come from a user-confirmed map pin. Never invent a point for a legacy record. */
export interface MapPoint { lat: number; lng: number }
export function validMapPoint(point: unknown): point is MapPoint {
  if (!point || typeof point !== 'object') return false;
  const p = point as MapPoint;
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -85 && p.lat <= 85 && p.lng >= -180 && p.lng <= 180;
}
export function readMapPoint(data: { get(key: string): unknown }, prefix = 'map'): MapPoint | null {
  const lat = data.get(`${prefix}Lat`), lng = data.get(`${prefix}Lng`);
  if (typeof lat !== 'string' || typeof lng !== 'string' || !lat.trim() || !lng.trim()) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return data.get(`${prefix}Confirmed`) === 'yes' && validMapPoint(point) ? point : null;
}
