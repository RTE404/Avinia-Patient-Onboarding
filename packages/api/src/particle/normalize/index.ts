import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { Retrieval } from '../retrieve.js';
import { fromFlat } from './fromFlat.js';
import { fromFhir } from './fromFhir.js';

export function normalize(patientId: string, retrieval: Retrieval): NormalizedPatientRecord {
  if (retrieval.format === 'FLAT') {
    return fromFlat(patientId, retrieval.data);
  }
  return fromFhir(patientId, retrieval.data);
}
