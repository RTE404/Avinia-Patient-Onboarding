import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { ProgressState } from './ProgressState.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('ProgressState', () => {
  it('polls the job status and calls onComplete with the record once COMPLETE', async () => {
    const record = { patientId: 'ppid-1', sourceFormat: 'FHIR' };
    vi.spyOn(apiClient, 'pollJob')
      .mockResolvedValueOnce({ id: 'job-1', state: 'RUNNING', particleState: 'RUNNING' })
      .mockResolvedValueOnce({ id: 'job-1', state: 'COMPLETE', record });
    const onComplete = vi.fn();

    render(<ProgressState jobId="job-1" onComplete={onComplete} pollIntervalMs={10} />);

    expect(screen.getByText(/searching provider networks/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(30);

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(record));
  });

  it('shows an error state if the job ends in ERROR', async () => {
    vi.spyOn(apiClient, 'pollJob').mockResolvedValue({
      id: 'job-2',
      state: 'ERROR',
      error: 'Query timed out',
    });

    render(<ProgressState jobId="job-2" onComplete={vi.fn()} pollIntervalMs={10} />);

    await vi.advanceTimersByTimeAsync(30);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Query timed out'));
  });
});
