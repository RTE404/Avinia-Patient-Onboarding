import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as patients from './particle/patients.js';
import * as retrieve from './particle/retrieve.js';
import { runFlow, QueryTimeoutError } from './flow.js';
import type { SandboxPatient } from '@onboarding/shared';

const bronzePatient: SandboxPatient = {
  name: 'Hart Fallon',
  tier: 'BRONZE',
  demographics: {
    given_name: 'Hart',
    family_name: 'Fallon',
    gender: 'MALE',
    date_of_birth: '1952-10-01',
    address_lines: ['456 Elm Street'],
    address_city: 'Sample City',
    address_state: 'NY',
    postal_code: '11206',
    patient_id: 'test-007',
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('runFlow', () => {
  it('registers, starts a query, polls until COMPLETE, retrieves, and normalizes', async () => {
    vi.spyOn(patients, 'registerPatient').mockResolvedValue({
      ...bronzePatient.demographics,
      particle_patient_id: 'ppid-1',
    });
    vi.spyOn(patients, 'startQuery').mockResolvedValue({
      query_id: 'q-1',
      particle_patient_id: 'ppid-1',
      purpose_of_use: 'INDIVIDUAL_ACCESS',
    });
    vi.spyOn(patients, 'getQueryStatus')
      .mockResolvedValueOnce({ id: 'q-1', state: 'RUNNING', particle_patient_id: 'ppid-1' })
      .mockResolvedValueOnce({ id: 'q-1', state: 'COMPLETE', particle_patient_id: 'ppid-1' });
    vi.spyOn(retrieve, 'retrieveByTier').mockResolvedValue({
      format: 'FHIR',
      data: { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] },
    });

    const progressStates: string[] = [];
    const record = await runFlow(bronzePatient, {
      pollIntervalMs: 1,
      onProgress: (state) => progressStates.push(state),
    });

    expect(record.patientId).toBe('ppid-1');
    expect(record.sourceFormat).toBe('FHIR');
    expect(progressStates).toEqual(['RUNNING', 'COMPLETE']);
    expect(patients.getQueryStatus).toHaveBeenCalledTimes(2);
  });

  it('throws QueryTimeoutError if the query never reaches COMPLETE within maxWaitMs', async () => {
    vi.spyOn(patients, 'registerPatient').mockResolvedValue({
      ...bronzePatient.demographics,
      particle_patient_id: 'ppid-2',
    });
    vi.spyOn(patients, 'startQuery').mockResolvedValue({
      query_id: 'q-2',
      particle_patient_id: 'ppid-2',
      purpose_of_use: 'INDIVIDUAL_ACCESS',
    });
    vi.spyOn(patients, 'getQueryStatus').mockResolvedValue({
      id: 'q-2',
      state: 'RUNNING',
      particle_patient_id: 'ppid-2',
    });

    await expect(
      runFlow(bronzePatient, { pollIntervalMs: 1, maxWaitMs: 5 }),
    ).rejects.toThrow(QueryTimeoutError);
  });
});
