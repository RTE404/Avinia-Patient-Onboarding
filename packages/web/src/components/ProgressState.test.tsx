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

  it('surfaces an alert when a poll request itself fails instead of silently stopping', async () => {
    // pollJob throws on any non-ok response, and the self-rescheduling loop
    // only re-arms on the success path — so an unhandled rejection used to
    // stop polling forever while the UI still said "searching".
    vi.spyOn(apiClient, 'pollJob').mockRejectedValue(new Error('Failed to poll job: 503'));

    render(<ProgressState jobId="job-3" onComplete={vi.fn()} pollIntervalMs={10} />);

    await vi.advanceTimersByTimeAsync(30);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to poll job: 503'),
    );
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
