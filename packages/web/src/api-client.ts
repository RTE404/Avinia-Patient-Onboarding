const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export async function submitDemographics(patientId: string): Promise<{ patientId: string }> {
  const res = await fetch(`${API_BASE}/api/demographics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId }),
  });
  if (!res.ok) throw new Error(`Failed to register: ${res.status}`);
  return res.json();
}

export async function submitConsent(patientId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, accepted: true }),
  });
  if (!res.ok) throw new Error(`Failed to submit consent: ${res.status}`);
}

export interface RecordsResponse {
  status: 'CACHED' | 'LIVE_STARTED';
  record?: unknown;
  jobId?: string;
}

export async function fetchRecords(patientId: string): Promise<RecordsResponse> {
  const res = await fetch(`${API_BASE}/api/records/${patientId}`);
  if (res.status === 403) throw new Error('Consent required before fetching records');
  if (!res.ok && res.status !== 202) throw new Error(`Failed to fetch records: ${res.status}`);
  return res.json();
}

export interface JobStatus {
  id: string;
  state: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR';
  particleState?: string;
  record?: unknown;
  error?: string;
}

export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/records/live/${jobId}/status`);
  if (!res.ok) throw new Error(`Failed to poll job: ${res.status}`);
  return res.json();
}
