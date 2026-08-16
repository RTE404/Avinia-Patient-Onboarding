import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Results } from './Results.js';
import type { NormalizedPatientRecord } from '@onboarding/shared';

beforeEach(() => {
  vi.restoreAllMocks();
});

const populatedRecord: NormalizedPatientRecord = {
  patientId: 'ppid-1',
  sourceFormat: 'FHIR',
  demographics: { givenName: 'Hart', familyName: 'Fallon', gender: 'male', dateOfBirth: '1952-10-01' },
  providers: [{ id: 'p1', givenName: 'Meredith', familyName: 'Gray', specialty: 'Primary Care' }],
  organizations: [{ id: 'o1', name: 'Sample City Clinic', city: 'Sample City', state: 'NY' }],
  encounters: [{ id: 'e1', typeName: 'Ambulatory', startTime: '2020-01-01', endTime: null, providerId: 'p1' }],
  conditions: [{ id: 'c1', name: 'Type 2 diabetes', code: 'E11.9', clinicalStatus: 'active', onsetDate: '2018-01-01' }],
  medications: [{ id: 'm1', name: 'Metformin', code: null, status: 'active', doseValue: '500', doseUnit: 'mg', doseRoute: 'oral' }],
  allergies: [{ id: 'a1', substance: 'Penicillin', reaction: 'Hives', severity: 'moderate' }],
  immunizations: [{ id: 'i1', name: 'Influenza', date: '2023-10-15' }],
  labResults: [{ id: 'l1', name: 'HbA1c', value: '6.5', unit: '%', interpretation: null, timestamp: '2021-06-01' }],
};

describe('Results', () => {
  it('renders a populated record immediately when the backend returns CACHED', async () => {
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'CACHED', record: populatedRecord });

    render(<Results patientId="test-007" />);

    await waitFor(() => expect(screen.getByText('Hart Fallon')).toBeInTheDocument());
    expect(screen.getByText('Meredith Gray')).toBeInTheDocument();
    expect(screen.getByText('Type 2 diabetes')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
  });

  it('shows explicit "not available" states for sparse sections instead of hiding or erroring', async () => {
    const sparseRecord: NormalizedPatientRecord = {
      ...populatedRecord,
      providers: [],
      conditions: [],
      medications: [],
      allergies: [],
      immunizations: [],
      labResults: [],
      organizations: [],
    };
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'CACHED', record: sparseRecord });

    render(<Results patientId="test-007" />);

    await waitFor(() => expect(screen.getByText('Hart Fallon')).toBeInTheDocument());
    expect(screen.getByText(/No provider information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No condition information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No medication information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No allergy information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No immunization information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No lab result information available/i)).toBeInTheDocument();
  });

  it('shows ProgressState and does not crash when the backend returns LIVE_STARTED', async () => {
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'LIVE_STARTED', jobId: 'job-1' });
    vi.spyOn(apiClient, 'pollJob').mockResolvedValue({ id: 'job-1', state: 'RUNNING', particleState: 'RUNNING' });

    render(<Results patientId="test-002" />);

    await waitFor(() => expect(screen.getByText(/searching provider networks/i)).toBeInTheDocument());
  });

  it('ignores a stale response from an earlier (StrictMode-duplicate) effect run', async () => {
    const staleRecord: NormalizedPatientRecord = {
      ...populatedRecord,
      demographics: { ...populatedRecord.demographics, givenName: 'Stale', familyName: 'Patient' },
    };

    let callCount = 0;
    vi.spyOn(apiClient, 'fetchRecords').mockImplementation(() => {
      callCount += 1;
      // The first (StrictMode-duplicate, effectively orphaned) call resolves
      // after the second — the classic out-of-order-response race a missing
      // cancellation guard is vulnerable to.
      if (callCount === 1) {
        return new Promise((resolve) =>
          setTimeout(() => resolve({ status: 'CACHED', record: staleRecord }), 30),
        );
      }
      return Promise.resolve({ status: 'CACHED', record: populatedRecord });
    });

    render(
      <StrictMode>
        <Results patientId="test-007" />
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByText('Hart Fallon')).toBeInTheDocument());

    // Give the slower, stale first call time to resolve and confirm it
    // didn't clobber the state the second (current) effect run already set.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Hart Fallon')).toBeInTheDocument();
    expect(screen.queryByText('Stale Patient')).not.toBeInTheDocument();
  });
});
