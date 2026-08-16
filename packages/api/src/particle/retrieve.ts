import { getAccessToken } from './client.js';
import type { SandboxTier } from '@onboarding/shared';

const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';

export type FlatDomains = Record<string, Array<Record<string, unknown>>>;

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: string;
  total: number;
  // Optional on purpose: a searchset Bundle with no results omits `entry`
  // entirely rather than sending an empty array, so every reader has to cope
  // with it being absent.
  entry?: Array<{ fullUrl: string; resource: FhirResource }>;
}

async function authorizedGet<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Particle retrieval failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function fetchFlat(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FlatDomains> {
  return authorizedGet<FlatDomains>(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/flat`,
    fetchImpl,
  );
}

export async function fetchFhir(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FhirBundle> {
  return authorizedGet<FhirBundle>(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/fhir`,
    fetchImpl,
  );
}

export type Retrieval =
  | { format: 'FLAT'; data: FlatDomains }
  | { format: 'FHIR'; data: FhirBundle };

export async function retrieveByTier(
  particlePatientId: string,
  tier: SandboxTier,
  fetchImpl: typeof fetch = fetch,
): Promise<Retrieval> {
  if (tier === 'GOLD') {
    return { format: 'FLAT', data: await fetchFlat(particlePatientId, fetchImpl) };
  }
  return { format: 'FHIR', data: await fetchFhir(particlePatientId, fetchImpl) };
}
