import { useState } from 'react';
import { submitConsent } from '../api-client.js';

export function Consent({ patientId, onConsented }: { patientId: string; onConsented: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuthorize() {
    setSubmitting(true);
    setError(null);
    try {
      await submitConsent(patientId);
      onConsented();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Authorize record retrieval</h1>
      <p>
        By continuing, you authorize retrieval of your available medical records from
        healthcare organizations across the United States, for your own access and use.
      </p>
      <button disabled={submitting} onClick={handleAuthorize}>
        I authorize retrieval of my records
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
