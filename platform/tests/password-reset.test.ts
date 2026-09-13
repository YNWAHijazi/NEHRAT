import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), get: vi.fn(), run: vi.fn(), configured: vi.fn(), send: vi.fn() }));
vi.mock('../lib/db', () => ({ getDb: () => ({ prepare: mocks.prepare }) }));
vi.mock('../lib/email', () => ({ emailConfigured: mocks.configured, sendLinkEmail: mocks.send }));
import { deliverPasswordReset } from '../lib/password-reset';
afterEach(() => vi.resetAllMocks());
function setup() {
  mocks.configured.mockReturnValue(true);
  mocks.prepare.mockReturnValue({ get: mocks.get, run: mocks.run });
  mocks.send.mockResolvedValue('sent');
}
describe('password recovery delivery', () => {
  it('reports unavailable configuration before looking up any account', async () => {
    mocks.configured.mockReturnValue(false);
    expect(await deliverPasswordReset('user@example.test')).toBe('unavailable');
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it('sends the stored single-use token to the activation route', async () => {
    setup(); mocks.get.mockReturnValueOnce({ id: 4, is_demo: 0 }).mockReturnValueOnce(undefined);
    expect(await deliverPasswordReset('user@example.test')).toBe('requested');
    const token = mocks.run.mock.calls[0]![0];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.test', path: `/activate/${token}`, isDemo: false }));
  });
  it('gives unknown and demo addresses the same answer without sending', async () => {
    setup(); mocks.get.mockReturnValueOnce(undefined).mockReturnValueOnce({ id: 4, is_demo: 1 });
    expect(await deliverPasswordReset('unknown@example.test')).toBe('requested');
    expect(await deliverPasswordReset('demo@example.test')).toBe('requested');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('does not issue another token for rapid repeated requests', async () => {
    setup(); mocks.get.mockReturnValueOnce({ id: 4, is_demo: 0 }).mockReturnValueOnce({ token: 'existing' });
    expect(await deliverPasswordReset('user@example.test')).toBe('requested');
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('removes an undelivered token and keeps the public response uniform', async () => {
    setup(); mocks.get.mockReturnValueOnce({ id: 4, is_demo: 0 }).mockReturnValueOnce(undefined); mocks.send.mockResolvedValue('failed');
    expect(await deliverPasswordReset('user@example.test')).toBe('requested');
    expect(mocks.prepare).toHaveBeenLastCalledWith('DELETE FROM password_resets WHERE token = ?');
    expect(mocks.run.mock.calls[1]![0]).toBe(mocks.run.mock.calls[0]![0]);
  });
});
