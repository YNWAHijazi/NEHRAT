import { beforeEach, describe, expect, it, vi } from 'vitest';
import { csvCell, csvDocument } from '../lib/csv';
import { currentAccount, type Account } from '../lib/auth';
import { adminRecords } from '../lib/queries';
import { GET } from '../app/api/admin/records/export/route';

vi.mock('../lib/auth', () => ({ currentAccount: vi.fn() }));
vi.mock('../lib/queries', () => ({ adminRecords: vi.fn(() => []) }));

beforeEach(() => vi.clearAllMocks());

describe('record downloads', () => {
  it.each([null, 'organizer', 'ems', 'director', 'reviewer', 'order'] as const)('refuses role %s before querying data', async (role) => {
    vi.mocked(currentAccount).mockResolvedValue(role ? { role } as Account : null);
    expect((await GET(new Request('https://example.test/api/admin/records/export'))).status).toBe(404);
    expect(adminRecords).not.toHaveBeenCalled();
  });

  it.each(['ministry_admin', 'platform_owner'] as const)('exports for %s using the session demo boundary and current filters', async (role) => {
    vi.mocked(currentAccount).mockResolvedValue({ role, isDemo: true } as Account);
    const response = await GET(new Request('https://example.test/api/admin/records/export?level=3&status=filed&q=Beirut&isDemo=false'));
    expect(response.status).toBe(200);
    expect(adminRecords).toHaveBeenCalledWith(true, { level: 3, status: 'filed', search: 'Beirut' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(await response.text()).toContain('اسم الفعالية');
  });

  it('quotes delimiters and line breaks, preserves Arabic, and neutralizes formulas', () => {
    expect(csvCell('A,"B"\nC')).toBe('"A,""B""\nC"');
    for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '  =1', '\t=1', '\r=1']) {
      expect(csvCell(value).startsWith('"\'')).toBe(true);
    }
    expect(csvDocument([['بيروت', null, 3]])).toBe('\uFEFF"بيروت","","3"\r\n');
  });
});
