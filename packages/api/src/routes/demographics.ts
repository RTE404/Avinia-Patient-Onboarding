import { Router } from 'express';
import { sandboxPatients } from '@onboarding/shared';

export const demographicsRouter = Router();

// This endpoint confirms the submitted patient is one of the fixed sandbox
// patients and nothing more. It used to also call Particle's registerPatient,
// but the particlePatientId it returned had no consumer anywhere — the
// frontend discards it — and runFlow registers the same patient again when the
// live path runs, so every live-path patient was registered with Particle
// twice. Registration now happens exactly once, inside runFlow.
demographicsRouter.post('/api/demographics', (req, res) => {
  const { patientId } = req.body as { patientId?: string };
  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }
  res.status(200).json({ patientId: patient.demographics.patient_id });
});
