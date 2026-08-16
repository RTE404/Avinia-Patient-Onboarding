import { useState } from 'react';

export function IdentityVerification({ onVerified }: { onVerified: () => void }) {
  const [verifying, setVerifying] = useState(false);

  function handleVerify() {
    setVerifying(true);
    // Mocked identity verification: this demo does not integrate a real IDV
    // vendor. A production build would call one here (e.g. Persona, Stripe
    // Identity) instead of this simulated delay.
    setTimeout(() => {
      setVerifying(false);
      onVerified();
    }, 1000);
  }

  return (
    <div>
      <h1>Verify your identity</h1>
      <p>In a production build, this step would collect an ID document scan and a liveness check.</p>
      <button disabled={verifying} onClick={handleVerify}>
        {verifying ? 'Verifying...' : 'Simulate identity verification'}
      </button>
    </div>
  );
}
