import { getAccessToken } from './client.js';
import type { SandboxPatientDemographics } from '@onboarding/shared';

const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';

export interface RegisteredPatient extends SandboxPatientDemographics {
  particle_patient_id: string;
}

export async function registerPatient(
  demographics: SandboxPatientDemographics,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisteredPatient> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(`${PARTICLE_BASE_URL}/api/v2/patients`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(demographics),
  });

  if (!response.ok) {
    throw new Error(`Particle patient registration failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as RegisteredPatient;
}

export interface QueryStartResult {
  query_id: string;
  particle_patient_id: string;
  purpose_of_use: string;
}

export async function startQuery(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QueryStartResult> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purpose_of_use: 'INDIVIDUAL_ACCESS' }),
    },
  );

  if (!response.ok) {
    throw new Error(`Particle query start failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as QueryStartResult;
}

export interface QueryStatus {
  id: string;
  state: string;
  particle_patient_id: string;
}

export async function getQueryStatus(
  particlePatientId: string,
  queryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QueryStatus> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/query?query_id=${queryId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Particle query status check failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as QueryStatus;
}
