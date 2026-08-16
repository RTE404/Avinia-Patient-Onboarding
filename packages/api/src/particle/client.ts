const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';
const TOKEN_TTL_MS = 60 * 60 * 1000; // Particle tokens are valid for 60 minutes
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

interface TokenState {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenState | null = null;

export async function getAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > now) {
    return cachedToken.token;
  }

  const clientId = process.env.PARTICLE_CLIENT_ID;
  const clientSecret = process.env.PARTICLE_CLIENT_SECRET;
  const scope = process.env.PARTICLE_SCOPE;

  if (!clientId || !clientSecret) {
    throw new Error('PARTICLE_CLIENT_ID and PARTICLE_CLIENT_SECRET must be set');
  }

  const headers: Record<string, string> = {
    'client-id': clientId,
    'client-secret': clientSecret,
  };
  if (scope) {
    headers['scope'] = scope;
  }

  const response = await fetchImpl(`${PARTICLE_BASE_URL}/auth`, { method: 'GET', headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Particle auth failed: ${response.status} ${body}`);
  }

  const token = (await response.text()).trim();
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

export function resetTokenCacheForTests(): void {
  cachedToken = null;
}
