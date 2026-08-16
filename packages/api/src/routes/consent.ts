import { Router } from 'express';
import { grantConsent } from '../consentStore.js';

export const consentRouter = Router();

consentRouter.post('/api/consent', (req, res) => {
  const { patientId, accepted } = req.body as { patientId?: string; accepted?: boolean };
  if (!patientId || accepted !== true) {
    res.status(400).json({ message: 'patientId and accepted=true are required' });
    return;
  }
  grantConsent(patientId);
  res.status(200).json({ patientId, consented: true });
});
