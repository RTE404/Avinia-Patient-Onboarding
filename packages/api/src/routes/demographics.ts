import { Router } from 'express';
import { sandboxPatients } from '@onboarding/shared';
import { registerPatient } from '../particle/patients.js';

export const demographicsRouter = Router();

demographicsRouter.post('/api/demographics', async (req, res) => {
  const { patientId } = req.body as { patientId?: string };
  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }
  try {
    const registered = await registerPatient(patient.demographics);
    res.status(200).json({ particlePatientId: registered.particle_patient_id });
  } catch (error) {
    res.status(502).json({ message: `Particle registration failed: ${(error as Error).message}` });
  }
});
