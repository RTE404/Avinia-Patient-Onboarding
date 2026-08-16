import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { FlatDomains } from '../retrieve.js';

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function record(row: Record<string, unknown>, key: string): string {
  const value = str(row[key]);
  return value ?? '';
}

export function fromFlat(patientId: string, flat: FlatDomains): NormalizedPatientRecord {
  const demo = flat.patients?.[0] ?? {};

  return {
    patientId,
    sourceFormat: 'FLAT',
    demographics: {
      givenName: record(demo, 'given_name'),
      familyName: record(demo, 'family_name'),
      gender: str(demo.gender),
      dateOfBirth: str(demo.date_of_birth),
    },
    providers: (flat.practitioners ?? []).map((p) => ({
      id: record(p, 'practitioner_id'),
      givenName: record(p, 'practitioner_given_name'),
      familyName: record(p, 'practitioner_family_name'),
      specialty: str(p.practitioner_role_specialty),
    })),
    organizations: (flat.organizations ?? []).map((o) => ({
      id: record(o, 'organization_id'),
      name: record(o, 'organization_name'),
      city: str(o.organization_address_city),
      state: str(o.organization_address_state),
    })),
    encounters: (flat.encounters ?? []).map((e) => ({
      id: record(e, 'encounter_id'),
      typeName: str(e.encounter_type_name),
      startTime: str(e.encounter_start_time),
      endTime: str(e.encounter_end_time),
      providerId: str(e.practitioner_role_id_references),
    })),
    conditions: (flat.problems ?? []).map((c) => ({
      id: record(c, 'condition_id'),
      name: str(c.condition_name) ?? 'Unknown condition',
      code: str(c.condition_code),
      clinicalStatus: str(c.condition_clinical_status),
      onsetDate: str(c.condition_onset_date),
    })),
    medications: (flat.medications ?? []).map((m) => ({
      id: record(m, 'medication_id'),
      name: str(m.medication_name) ?? 'Unknown medication',
      code: str(m.medication_code),
      status: str(m.medication_statement_status),
      doseValue: str(m.medication_statement_dose_value),
      doseUnit: str(m.medication_statement_dose_unit),
      doseRoute: str(m.medication_statement_dose_route),
    })),
    // Field names below (allergy_*, immunization_*) are inferred by
    // convention from every other domain's naming pattern — not directly
    // observed, since Particle's real sample data had zero records in
    // these two domains. Verify against live data once Task 8 runs.
    allergies: (flat.allergies ?? []).map((a) => ({
      id: record(a, 'allergy_id'),
      substance: str(a.allergy_substance_name) ?? 'Unknown substance',
      reaction: str(a.allergy_reaction),
      severity: str(a.allergy_severity),
    })),
    immunizations: (flat.immunizations ?? []).map((i) => ({
      id: record(i, 'immunization_id'),
      name: str(i.immunization_name) ?? 'Unknown immunization',
      date: str(i.immunization_date),
    })),
    labResults: (flat.labs ?? []).map((l) => ({
      id: record(l, 'lab_observation_id'),
      name: str(l.lab_name) ?? 'Unknown lab',
      value: str(l.lab_value),
      unit: str(l.lab_unit),
      interpretation: str(l.lab_interpretation),
      timestamp: str(l.lab_timestamp),
    })),
  };
}
