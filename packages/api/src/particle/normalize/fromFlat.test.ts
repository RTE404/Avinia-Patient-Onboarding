import { describe, it, expect } from 'vitest';
import { fromFlat } from './fromFlat.js';
import type { FlatDomains } from '../retrieve.js';

describe('fromFlat', () => {
  it('maps populated Flat domains to a NormalizedPatientRecord', () => {
    // Field names and shapes here are verified against Particle's real
    // sample data for patient Elvira Valadez (patient_id 6f3bc061-...).
    const flat: FlatDomains = {
      patients: [
        {
          given_name: 'Elvira',
          family_name: 'Valadez',
          gender: 'FEMALE',
          date_of_birth: '1970-12-26T00:00:00',
          patient_id: '6f3bc061-8515-41b9-bc26-75fc55f53284',
        },
      ],
      practitioners: [
        {
          practitioner_id: 'prac-1',
          practitioner_given_name: 'Meredith',
          practitioner_family_name: 'Gray',
          practitioner_role_specialty: 'Nurse Practitioner, Primary Care',
        },
      ],
      organizations: [
        {
          organization_id: 'org-1',
          organization_name: 'Rochester Hospital',
          organization_address_city: 'Rochester',
          organization_address_state: 'MA',
        },
      ],
      encounters: [
        {
          encounter_id: 'enc-1',
          encounter_type_name: 'Encounter for problem',
          encounter_start_time: '2011-05-28T15:19:11+0000',
          encounter_end_time: '2011-05-28T16:41:11+0000',
          practitioner_role_id_references: 'role-1',
        },
      ],
      problems: [
        {
          condition_id: 'cond-1',
          condition_name: 'Diabetic renal disease (disorder)',
          condition_code: '127013003',
          condition_clinical_status: 'active',
          condition_onset_date: '2011-05-28T15:19:11+0000',
        },
      ],
      medications: [
        {
          medication_id: 'med-1',
          medication_name: 'Epinephrine 0.3 MG Auto-Injector',
          medication_code: '727373',
          medication_statement_status: 'completed',
          medication_statement_dose_value: 0.3,
          medication_statement_dose_unit: 'mg',
          medication_statement_dose_route: 'Intramuscular',
        },
      ],
      allergies: [],
      immunizations: [],
      labs: [
        {
          lab_observation_id: 'lab-1',
          lab_name: 'RDW - Erythrocyte distribution width Auto (RBC)',
          lab_value: '41.95602730081661',
          lab_unit: 'fL',
          lab_interpretation: '',
          lab_timestamp: '2011-05-28T15:19:11+0000',
        },
      ],
    };

    const result = fromFlat('6f3bc061-8515-41b9-bc26-75fc55f53284', flat);

    expect(result.sourceFormat).toBe('FLAT');
    expect(result.demographics.givenName).toBe('Elvira');
    expect(result.demographics.familyName).toBe('Valadez');
    expect(result.providers).toEqual([
      { id: 'prac-1', givenName: 'Meredith', familyName: 'Gray', specialty: 'Nurse Practitioner, Primary Care' },
    ]);
    expect(result.organizations[0].name).toBe('Rochester Hospital');
    expect(result.encounters[0].typeName).toBe('Encounter for problem');
    expect(result.conditions[0].name).toBe('Diabetic renal disease (disorder)');
    expect(result.medications[0].doseValue).toBe('0.3');
    expect(result.labResults[0].value).toBe('41.95602730081661');
  });

  it('treats empty/sparse domains as valid input, not an error — this is the normal case', () => {
    const flat: FlatDomains = {
      patients: [
        {
          given_name: 'Hart',
          family_name: 'Fallon',
          gender: 'MALE',
          date_of_birth: '1952-10-01',
          patient_id: 'test-007',
        },
      ],
      practitioners: [
        // A practitioner record with a blank name is a real, observed case —
        // must not throw, must not crash string handling.
        { practitioner_id: 'prac-2', practitioner_given_name: '', practitioner_family_name: '' },
      ],
      organizations: [],
      encounters: [
        // An encounter with no linked practitioner — also a real observed case.
        { encounter_id: 'enc-2', encounter_type_name: 'Encounter for problem', encounter_start_time: '2020-01-01T00:00:00Z' },
      ],
      problems: [],
      medications: [],
      allergies: [],
      immunizations: [],
      labs: [],
    };

    const result = fromFlat('test-007', flat);

    expect(result.providers[0].givenName).toBe('');
    expect(result.providers[0].specialty).toBeNull();
    expect(result.encounters[0].providerId).toBeNull();
    expect(result.organizations).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.immunizations).toEqual([]);
  });
});
