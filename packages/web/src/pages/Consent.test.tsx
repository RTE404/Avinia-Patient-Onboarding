import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Consent } from './Consent.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Consent', () => {
  it('calls submitConsent and onConsented when the patient authorizes retrieval', async () => {
    vi.spyOn(apiClient, 'submitConsent').mockResolvedValue(undefined);
    const onConsented = vi.fn();

    render(<Consent patientId="test-007" onConsented={onConsented} />);
    fireEvent.click(screen.getByText(/I authorize/));

    await waitFor(() => expect(apiClient.submitConsent).toHaveBeenCalledWith('test-007'));
    await waitFor(() => expect(onConsented).toHaveBeenCalled());
  });

  it('shows an error if consent submission fails', async () => {
    vi.spyOn(apiClient, 'submitConsent').mockRejectedValue(new Error('Failed to submit consent: 500'));

    render(<Consent patientId="test-007" onConsented={vi.fn()} />);
    fireEvent.click(screen.getByText(/I authorize/));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to submit consent: 500'));
  });
});
