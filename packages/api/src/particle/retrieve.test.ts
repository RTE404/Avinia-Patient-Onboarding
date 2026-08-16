import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from './client.js';
import { fetchFlat, fetchFhir, retrieveByTier } from './retrieve.js';

beforeEach(() => {
  vi.spyOn(client, 'getAccessToken').mockResolvedValue('fake-token');
});

describe('fetchFlat', () => {
  it('GETs the flat endpoint and returns domain-keyed arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ patients: [{ given_name: 'Elvira' }], medications: [] }),
    });

    const result = await fetchFlat('ppid-1', fetchMock as unknown as typeof fetch);

    expect(result.patients).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-1/flat');
  });
});

describe('fetchFhir', () => {
  it('GETs the fhir endpoint and returns a searchset Bundle', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] }),
    });

    const result = await fetchFhir('ppid-2', fetchMock as unknown as typeof fetch);

    expect(result.resourceType).toBe('Bundle');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-2/fhir');
  });
});

describe('retrieveByTier', () => {
  it('calls fetchFlat for GOLD and fetchFhir for BRONZE', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] }),
    });

    const bronzeResult = await retrieveByTier('ppid-3', 'BRONZE', fetchMock as unknown as typeof fetch);
    expect(bronzeResult.format).toBe('FHIR');
    expect(fetchMock.mock.calls[0][0]).toContain('/fhir');

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ patients: [] }) });
    const goldResult = await retrieveByTier('ppid-4', 'GOLD', fetchMock as unknown as typeof fetch);
    expect(goldResult.format).toBe('FLAT');
    expect(fetchMock.mock.calls[0][0]).toContain('/flat');
  });
});
