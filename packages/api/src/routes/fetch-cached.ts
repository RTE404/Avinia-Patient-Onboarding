import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '../flow.js';
import { hasConsent } from '../consentStore.js';
import { createJob, updateJob } from '../jobs.js';

export const fetchCachedRouter = Router();
const CACHE_DIR = join(process.cwd(), 'src/cache');

fetchCachedRouter.get('/api/records/:patientId', (req, res) => {
  const { patientId } = req.params;

  if (!hasConsent(patientId)) {
    res.status(403).json({ message: 'Consent has not been given for this patient' });
    return;
  }

  const cachePath = join(CACHE_DIR, `${patientId}.json`);
  if (existsSync(cachePath)) {
    const record = JSON.parse(readFileSync(cachePath, 'utf-8'));
    res.status(200).json({ status: 'CACHED', record });
    return;
  }

  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }

  // Transparent fallback to the live path: start the same background flow
  // fetch-live would, and hand the caller a jobId to poll — same contract
  // as /live/start, so the frontend doesn't need to know which path it hit.
  const jobId = randomUUID();
  createJob(jobId);
  updateJob(jobId, { state: 'RUNNING' });
  runFlow(patient, { onProgress: (state) => updateJob(jobId, { particleState: state }) })
    .then((record) => updateJob(jobId, { state: 'COMPLETE', record }))
    .catch((error: Error) => updateJob(jobId, { state: 'ERROR', error: error.message }));

  res.status(202).json({ status: 'LIVE_STARTED', jobId });
});
