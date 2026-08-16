export type SandboxTier = 'GOLD' | 'BRONZE';

export interface SandboxPatientDemographics {
  given_name: string;
  family_name: string;
  gender: 'FEMALE' | 'MALE';
  date_of_birth: string;
  address_lines: string[];
  address_city: string;
  address_state: string;
  postal_code: string;
  patient_id: string;
}

export interface SandboxPatient {
  name: string;
  tier: SandboxTier;
  demographics: SandboxPatientDemographics;
}

export interface NormalizedProvider {
  id: string;
  givenName: string;
  familyName: string;
  specialty: string | null;
}

export interface NormalizedOrganization {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export interface NormalizedEncounter {
  id: string;
  typeName: string | null;
  startTime: string | null;
  endTime: string | null;
  providerId: string | null;
}

export interface NormalizedCondition {
  id: string;
  name: string;
  code: string | null;
  clinicalStatus: string | null;
  onsetDate: string | null;
}

export interface NormalizedMedication {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  doseValue: string | null;
  doseUnit: string | null;
  doseRoute: string | null;
}

export interface NormalizedAllergy {
  id: string;
  substance: string;
  reaction: string | null;
  severity: string | null;
}

export interface NormalizedImmunization {
  id: string;
  name: string;
  date: string | null;
}

export interface NormalizedLabResult {
  id: string;
  name: string;
  value: string | null;
  unit: string | null;
  interpretation: string | null;
  timestamp: string | null;
}

export interface NormalizedPatientRecord {
  patientId: string;
  sourceFormat: 'FLAT' | 'FHIR';
  demographics: {
    givenName: string;
    familyName: string;
    gender: string | null;
    dateOfBirth: string | null;
  };
  providers: NormalizedProvider[];
  organizations: NormalizedOrganization[];
  encounters: NormalizedEncounter[];
  conditions: NormalizedCondition[];
  medications: NormalizedMedication[];
  allergies: NormalizedAllergy[];
  immunizations: NormalizedImmunization[];
  labResults: NormalizedLabResult[];
}
