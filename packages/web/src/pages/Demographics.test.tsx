import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Demographics } from './Demographics.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Demographics', () => {
  it('renders all 8 sandbox patients and calls onSelected after successful registration', async () => {
    vi.spyOn(apiClient, 'submitDemographics').mockResolvedValue({ particlePatientId: 'ppid-007' });
    const onSelected = vi.fn();

    render(<Demographics onSelected={onSelected} />);

    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByText(/Hart Fallon/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Hart Fallon/));

    await waitFor(() => expect(onSelected).toHaveBeenCalledWith('test-007'));
  });

  it('shows an error message if registration fails', async () => {
    vi.spyOn(apiClient, 'submitDemographics').mockRejectedValue(new Error('Failed to register: 502'));

    render(<Demographics onSelected={vi.fn()} />);
    fireEvent.click(screen.getByText(/Hart Fallon/));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to register: 502'));
  });
});
