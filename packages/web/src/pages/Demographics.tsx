import { useState } from 'react';
import { sandboxPatients } from '@onboarding/shared';
import { submitDemographics } from '../api-client.js';

export function Demographics({ onSelected }: { onSelected: (patientId: string) => void }) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(patientId: string) {
    setSubmitting(patientId);
    setError(null);
    try {
      await submitDemographics(patientId);
      onSelected(patientId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div>
      <h1>Select a patient</h1>
      <ul>
        {sandboxPatients.map((p) => (
          <li key={p.demographics.patient_id}>
            <button disabled={submitting !== null} onClick={() => handleSelect(p.demographics.patient_id)}>
              {p.name} ({p.tier})
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
