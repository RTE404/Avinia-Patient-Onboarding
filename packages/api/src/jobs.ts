import type { NormalizedPatientRecord } from '@onboarding/shared';

export type JobState = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR';

export interface Job {
  id: string;
  state: JobState;
  particleState?: string;
  record?: NormalizedPatientRecord;
  error?: string;
}

const jobs = new Map<string, Job>();

export function createJob(id: string): Job {
  const job: Job = { id, state: 'PENDING' };
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
