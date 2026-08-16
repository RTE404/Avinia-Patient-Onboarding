import { Router } from 'express';
import { sandboxPatients } from '@onboarding/shared';
import { grantConsent } from '../consentStore.js';

export const consentRouter = Router();

consentRouter.post('/api/consent', (req, res) => {
  const { patientId, accepted } = req.body as { patientId?: string; accepted?: boolean };
  if (!patientId || accepted !== true) {
    res.status(400).json({ message: 'patientId and accepted=true are required' });
    return;
  }
  // Consent may only be granted for one of the fixed sandbox patients, the
  // same validation POST /api/demographics already applies. Without this the
  // consent store accepted any string, which was the first half of a path
  // traversal into GET /api/records/:patientId.
  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }
  grantConsent(patient.demographics.patient_id);
  res.status(200).json({ patientId: patient.demographics.patient_id, consented: true });
});
