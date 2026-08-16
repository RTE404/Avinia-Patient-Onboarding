import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from './client.js';
import { registerPatient, startQuery, getQueryStatus } from './patients.js';
import type { SandboxPatientDemographics } from '@onboarding/shared';

const demographics: SandboxPatientDemographics = {
  given_name: 'Hart',
  family_name: 'Fallon',
  gender: 'MALE',
  date_of_birth: '1952-10-01',
  address_lines: ['456 Elm Street'],
  address_city: 'Sample City',
  address_state: 'NY',
  postal_code: '11206',
  patient_id: 'test-007',
};

beforeEach(() => {
  vi.spyOn(client, 'getAccessToken').mockResolvedValue('fake-token');
});

describe('registerPatient', () => {
  it('POSTs to /api/v2/patients with a bearer token and returns particle_patient_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...demographics, particle_patient_id: 'ppid-123' }),
    });

    const result = await registerPatient(demographics, fetchMock as unknown as typeof fetch);

    expect(result.particle_patient_id).toBe('ppid-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fake-token');
    expect(JSON.parse(init.body)).toEqual(demographics);
  });
});

describe('startQuery', () => {
  it('POSTs purpose_of_use INDIVIDUAL_ACCESS and returns a query_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query_id: 'q-1',
        particle_patient_id: 'ppid-123',
        purpose_of_use: 'INDIVIDUAL_ACCESS',
      }),
    });

    const result = await startQuery('ppid-123', fetchMock as unknown as typeof fetch);

    expect(result.query_id).toBe('q-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-123/query');
    expect(JSON.parse(init.body)).toEqual({ purpose_of_use: 'INDIVIDUAL_ACCESS' });
  });
});

describe('getQueryStatus', () => {
  it('GETs the query status and returns the state field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'q-1', state: 'COMPLETE', particle_patient_id: 'ppid-123' }),
    });

    const result = await getQueryStatus('ppid-123', 'q-1', fetchMock as unknown as typeof fetch);

    expect(result.state).toBe('COMPLETE');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://sandbox.particlehealth.com/api/v2/patients/ppid-123/query?query_id=q-1',
    );
  });
});
