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
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // Self-rescheduling setTimeout rather than setInterval: the next poll is
    // only scheduled after the current one resolves and is confirmed
    // non-terminal. A fixed-cadence setInterval would keep firing on its own
    // schedule even while a poll's async response is still pending — racing
    // ahead of clearInterval() and (in a slow-response or fast-fake-timer
    // scenario) issuing an extra poll after the job has already completed.
    async function tick() {
      let job: JobStatus;
      try {
        job = await pollJob(jobId);
      } catch (e) {
        // pollJob throws on any non-ok response, and this loop only re-arms
        // itself on the success path — so without this the first transient
        // failure would stop polling forever while the UI kept claiming to be
        // searching. Surface it instead of stalling silently.
        if (cancelled) return;
        setPollError((e as Error).message);
        return;
      }
      if (cancelled) return;
      setStatus(job);
      if (job.state === 'COMPLETE') {
        onComplete(job.record);
        return;
      }
      if (job.state === 'ERROR') {
        return;
      }
      timer = setTimeout(tick, pollIntervalMs);
    }

    timer = setTimeout(tick, pollIntervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, pollIntervalMs, onComplete]);

  if (pollError) {
    return <p role="alert">{pollError}</p>;
  }

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
