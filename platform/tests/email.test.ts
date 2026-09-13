import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), run: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock('../lib/db', () => ({ getDb: () => ({ prepare: () => ({ run: mocks.run }) }) }));
import { sendLinkEmail } from '../lib/email';

const input = { to: 'person@example.test', path: '/invitations/test-token', subject: 'Invitation', text: 'Review and accept', isDemo: false };
function configure() {
  for (const [key, value] of Object.entries({ SMTP_HOST: 'smtp.example.test', SMTP_USER: 'sender', SMTP_PASSWORD: 'test-only', MAIL_FROM: 'sender@example.test', APP_BASE_URL: 'https://platform.example.test' })) vi.stubEnv(key, value);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe('invitation delivery', () => {
  it('never sends from demo accounts even when email is configured', async () => {
    configure();
    expect(await sendLinkEmail({ ...input, isDemo: true })).toBe('demo');
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });
  it('reports missing configuration without claiming delivery', async () => {
    vi.stubEnv('SMTP_HOST', '');
    expect(await sendLinkEmail(input)).toBe('notConfigured');
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });
  it('sends an absolute link over verified TLS and logs no token or message', async () => {
    configure(); mocks.sendMail.mockResolvedValue({ accepted: [input.to] });
    expect(await sendLinkEmail(input)).toBe('sent');
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, tls: { rejectUnauthorized: true } }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ text: 'Review and accept\n\nhttps://platform.example.test/invitations/test-token' }));
    expect(mocks.run).toHaveBeenCalledWith(input.to, 'sent', 0);
  });
  it('does not leak a transport failure or falsely report success', async () => {
    configure(); mocks.sendMail.mockRejectedValue(new Error('secret diagnostic'));
    expect(await sendLinkEmail(input)).toBe('failed');
    expect(mocks.run).toHaveBeenCalledWith(input.to, 'failed', 0);
  });
  it('refuses a link pointing outside the configured site', async () => {
    configure();
    expect(await sendLinkEmail({ ...input, path: 'https://other.example.test/' })).toBe('failed');
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
