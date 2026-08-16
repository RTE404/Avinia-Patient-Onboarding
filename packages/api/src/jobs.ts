import type { NormalizedPatientRecord } from '@onboarding/shared';

export type JobState = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR';

export interface Job {
  id: string;
  /** The sandbox patient this job is retrieving records for, so the job's
   *  status (which carries the full record once COMPLETE) can be consent-gated
   *  the same way the record routes are. */
  patientId: string;
  state: JobState;
  particleState?: string;
  record?: NormalizedPatientRecord;
  error?: string;
}

const jobs = new Map<string, Job>();

export function createJob(id: string, patientId: string): Job {
  const job: Job = { id, patientId, state: 'PENDING' };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const existing = jobs.get(id);
  if (!existing) return;
  jobs.set(id, { ...existing, ...patch });
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
