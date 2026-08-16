import type { NormalizedPatientRecord, SandboxPatient } from '@onboarding/shared';
import { registerPatient, startQuery, getQueryStatus } from './particle/patients.js';
import { retrieveByTier } from './particle/retrieve.js';
import { normalize } from './particle/normalize/index.js';

export class QueryTimeoutError extends Error {
  constructor(public readonly queryId: string) {
    super(`Query ${queryId} did not complete within the timeout window`);
    this.name = 'QueryTimeoutError';
  }
}

export interface FlowOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onProgress?: (state: string) => void;
  fetchImpl?: typeof fetch;
}

export async function runFlow(
  patient: SandboxPatient,
  options: FlowOptions = {},
): Promise<NormalizedPatientRecord> {
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const maxWaitMs = options.maxWaitMs ?? 10 * 60 * 1000;
  const fetchImpl = options.fetchImpl ?? fetch;

  const registered = await registerPatient(patient.demographics, fetchImpl);
  const { query_id: queryId } = await startQuery(registered.particle_patient_id, fetchImpl);

  const deadline = Date.now() + maxWaitMs;
  let state = 'PENDING';
  while (state !== 'COMPLETE') {
    if (Date.now() > deadline) {
      throw new QueryTimeoutError(queryId);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const status = await getQueryStatus(registered.particle_patient_id, queryId, fetchImpl);
    state = status.state;
    options.onProgress?.(state);
  }

  const retrieval = await retrieveByTier(registered.particle_patient_id, patient.tier, fetchImpl);
  return normalize(registered.particle_patient_id, retrieval);
}
