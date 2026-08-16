import { useState } from 'react';
import { Demographics } from './pages/Demographics.js';

export function App() {
  const [patientId, setPatientId] = useState<string | null>(null);

  if (!patientId) {
    return <Demographics onSelected={setPatientId} />;
  }

  return <p>Patient {patientId} selected. Identity verification and consent steps coming in the next task.</p>;
}
