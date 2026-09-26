/** Level 3 plans belong to confirmed medical partners; lower levels remain organizer work. */
export function canPreparePlan(level: number | null, role: 'organizer' | 'director' | 'ems'): boolean {
  return level === 3 ? role === 'director' || role === 'ems' : level !== null && role === 'organizer';
}
