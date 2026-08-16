import { useState } from 'react';
import { Demographics } from './pages/Demographics.js';
import { IdentityVerification } from './pages/IdentityVerification.js';
import { Consent } from './pages/Consent.js';

type Step = 'demographics' | 'idv' | 'consent' | 'results';

export function App() {
  const [step, setStep] = useState<Step>('demographics');
  const [patientId, setPatientId] = useState<string | null>(null);

  if (step === 'demographics') {
    return (
      <Demographics
        onSelected={(id) => {
          setPatientId(id);
          setStep('idv');
        }}
      />
    );
  }

  if (step === 'idv') {
    return <IdentityVerification onVerified={() => setStep('consent')} />;
  }

  if (step === 'consent' && patientId) {
    return <Consent patientId={patientId} onConsented={() => setStep('results')} />;
  }

  return <p>Patient {patientId} consented. Results view coming in the next task.</p>;
}
