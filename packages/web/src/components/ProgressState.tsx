import { useEffect, useState } from 'react';
import { pollJob, type JobStatus } from '../api-client.js';

export function ProgressState({
  jobId,
  onComplete,
  pollIntervalMs = 5000,
}: {
  jobId: string;
  onComplete: (record: unknown) => void;
  pollIntervalMs?: number;
}) {
  const [status, setStatus] = useState<JobStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const job = await pollJob(jobId);
      if (cancelled) return;
      setStatus(job);
      if (job.state === 'COMPLETE') {
        clearInterval(interval);
        onComplete(job.record);
      }
      if (job.state === 'ERROR') {
        clearInterval(interval);
      }
    }, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, pollIntervalMs, onComplete]);

  if (status?.state === 'ERROR') {
    return <p role="alert">{status.error}</p>;
  }

  return (
    <div>
      <h1>Searching provider networks across the United States...</h1>
      <p>This typically takes 3-5 minutes. Current state: {status?.particleState ?? 'starting'}</p>
    </div>
  );
}
