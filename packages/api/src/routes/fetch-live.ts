import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '../flow.js';
import { hasConsent } from '../consentStore.js';
import { createJob, updateJob, getJob } from '../jobs.js';

export const fetchLiveRouter = Router();

fetchLiveRouter.post('/api/records/:patientId/live/start', (req, res) => {
  const { patientId } = req.params;

  if (!hasConsent(patientId)) {
    res.status(403).json({ message: 'Consent has not been given for this patient' });
    return;
  }

  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }

  const jobId = randomUUID();
  createJob(jobId);
  updateJob(jobId, { state: 'RUNNING' });
  runFlow(patient, { onProgress: (state) => updateJob(jobId, { particleState: state }) })
    .then((record) => updateJob(jobId, { state: 'COMPLETE', record }))
    .catch((error: Error) => updateJob(jobId, { state: 'ERROR', error: error.message }));

  res.status(202).json({ jobId });
});

fetchLiveRouter.get('/api/records/live/:jobId/status', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ message: 'Unknown job id' });
    return;
  }
  res.status(200).json(job);
});
