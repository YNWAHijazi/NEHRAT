import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn(), run: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock('../lib/db', () => ({ getDb: () => ({ prepare: () => ({ run: mocks.run }) }) }));
import { emailConfigured, sendLinkEmail } from '../lib/email';

const input = { to: 'person@example.test', path: '/invitations/test-token', subject: 'Invitation', text: 'Review and accept', isDemo: false };
function configure() {
  for (const [key, value] of Object.entries({ SMTP_HOST: 'smtp.example.test', SMTP_USER: 'sender', SMTP_PASSWORD: 'test-only', MAIL_FROM: 'sender@example.test', APP_BASE_URL: 'https://platform.example.test' })) vi.stubEnv(key, value);
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });
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

describe('Resend delivery', () => {
  function resend() {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('MAIL_FROM', 'NEHRAT <sender@example.test>');
    vi.stubEnv('APP_BASE_URL', 'https://platform.example.test');
    vi.stubEnv('SMTP_HOST', '');
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'message-id' }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    return request;
  }
  it('uses HTTPS without SMTP and provides a stable idempotency key', async () => {
    const request = resend();
    expect(emailConfigured()).toBe(true);
    expect(await sendLinkEmail(input)).toBe('sent');
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(options.body)).toEqual({ from: 'NEHRAT <sender@example.test>', to: [input.to], subject: input.subject, text: 'Review and accept\n\nhttps://platform.example.test/invitations/test-token' });
    expect(options.headers['Idempotency-Key']).toMatch(/^[a-f0-9]{64}$/);
    request.mockResolvedValue(new Response(JSON.stringify({ id: 'same-message-id' }), { status: 200 }));
    await sendLinkEmail(input);
    expect(request.mock.calls[1]![1].headers['Idempotency-Key']).toBe(options.headers['Idempotency-Key']);
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.run).toHaveBeenCalledWith(input.to, 'sent', 0);
  });
  it.each([401, 422, 429, 500])('records HTTP %i as failed without exposing diagnostics', async (status) => {
    const request = resend();
    request.mockResolvedValue(new Response('private provider diagnostic', { status }));
    expect(await sendLinkEmail(input)).toBe('failed');
    expect(mocks.run).toHaveBeenCalledWith(input.to, 'failed', 0);
  });
  it('does not claim delivery on timeout or an invalid response', async () => {
    const request = resend(); request.mockRejectedValueOnce(new Error('timeout'));
    expect(await sendLinkEmail(input)).toBe('failed');
    request.mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await sendLinkEmail(input)).toBe('failed');
  });
  it('never sends demo email or a link outside the platform', async () => {
    const request = resend();
    expect(await sendLinkEmail({ ...input, isDemo: true })).toBe('demo');
    expect(await sendLinkEmail({ ...input, path: 'https://other.example.test' })).toBe('failed');
    expect(request).not.toHaveBeenCalled();
  });
});
