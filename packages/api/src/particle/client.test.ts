import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAccessToken, resetTokenCacheForTests } from './client.js';

describe('getAccessToken', () => {
  beforeEach(() => {
    resetTokenCacheForTests();
    vi.stubEnv('PARTICLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('PARTICLE_CLIENT_SECRET', 'test-client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches a token from GET /auth with credential headers and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'fake.jwt.token',
    });

    const token1 = await getAccessToken(fetchMock as unknown as typeof fetch);
    const token2 = await getAccessToken(fetchMock as unknown as typeof fetch);

    expect(token1).toBe('fake.jwt.token');
    expect(token2).toBe('fake.jwt.token');
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/auth');
    expect(init.headers['client-id']).toBe('test-client-id');
    expect(init.headers['client-secret']).toBe('test-client-secret');
  });

  it('throws if credentials are missing', async () => {
    vi.unstubAllEnvs();
    await expect(getAccessToken(vi.fn() as unknown as typeof fetch)).rejects.toThrow(
      'PARTICLE_CLIENT_ID and PARTICLE_CLIENT_SECRET must be set',
    );
  });
});
