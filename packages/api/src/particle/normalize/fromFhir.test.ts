import { describe, it, expect } from 'vitest';
import { fromFhir } from './fromFhir.js';
import type { FhirBundle } from '../retrieve.js';

function bundle(resources: Array<Record<string, unknown>>): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((r) => ({ fullUrl: `urn:${r.resourceType}/${r.id}`, resource: r as any })),
  };
}

describe('fromFhir', () => {
  it('maps a populated FHIR Bundle to a NormalizedPatientRecord', () => {
    const b = bundle([
      {
        resourceType: 'Patient',
        id: 'pat-1',
        name: [{ given: ['Hart'], family: 'Fallon' }],
        gender: 'male',
        birthDate: '1952-10-01',
      },
      {
        resourceType: 'Practitioner',
        id: 'prac-1',
        name: [{ given: ['Meredith'], family: 'Gray' }],
      },
      {
        resourceType: 'PractitionerRole',
        id: 'role-1',
        practitioner: { reference: 'Practitioner/prac-1' },
        specialty: [{ coding: [{ display: 'Primary Care' }] }],
      },
      {
        resourceType: 'Organization',
        id: 'org-1',
        name: 'Sample City Clinic',
        address: [{ city: 'Sample City', state: 'NY' }],
      },
      {
        resourceType: 'Encounter',
        id: 'enc-1',
        type: [{ coding: [{ display: 'Ambulatory' }] }],
        period: { start: '2020-01-01T00:00:00Z', end: '2020-01-01T01:00:00Z' },
        participant: [{ individual: { reference: 'Practitioner/prac-1' } }],
      },
      {
        resourceType: 'Condition',
        id: 'cond-1',
        code: { coding: [{ code: 'E11.9', display: 'Type 2 diabetes' }] },
        clinicalStatus: { coding: [{ display: 'active' }] },
        onsetDateTime: '2018-01-01',
      },
      {
        resourceType: 'MedicationStatement',
        id: 'med-1',
        medicationCodeableConcept: { coding: [{ code: '727373', display: 'Epinephrine' }] },
        status: 'active',
      },
      {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-1',
        code: { coding: [{ display: 'Penicillin' }] },
        reaction: [{ manifestation: [{ coding: [{ display: 'Rash' }] }], severity: 'moderate' }],
      },
      {
        resourceType: 'Immunization',
        id: 'imm-1',
        vaccineCode: { coding: [{ display: 'Influenza' }] },
        occurrenceDateTime: '2021-10-01',
      },
      {
        resourceType: 'Observation',
        id: 'obs-1',
        category: [{ coding: [{ code: 'laboratory' }] }],
        code: { coding: [{ display: 'Hemoglobin A1c' }] },
        valueQuantity: { value: 6.5, unit: '%' },
        effectiveDateTime: '2021-06-01',
      },
    ]);

    const result = fromFhir('ppid-bronze-1', b);

    expect(result.sourceFormat).toBe('FHIR');
    expect(result.demographics).toEqual({
      givenName: 'Hart',
      familyName: 'Fallon',
      gender: 'male',
      dateOfBirth: '1952-10-01',
    });
    expect(result.providers[0]).toEqual({
      id: 'prac-1',
      givenName: 'Meredith',
      familyName: 'Gray',
      specialty: 'Primary Care',
    });
    expect(result.organizations[0].name).toBe('Sample City Clinic');
    expect(result.encounters[0].typeName).toBe('Ambulatory');
    expect(result.conditions[0].name).toBe('Type 2 diabetes');
    expect(result.medications[0].name).toBe('Epinephrine');
    expect(result.allergies[0].substance).toBe('Penicillin');
    expect(result.allergies[0].severity).toBe('moderate');
    expect(result.immunizations[0].name).toBe('Influenza');
    expect(result.labResults[0].value).toBe('6.5');
  });

  it('treats a searchset Bundle with no entry property at all as empty, not an error', () => {
    // A FHIR searchset Bundle representing "no results" omits `entry`
    // entirely rather than sending an empty array — standard, expected
    // behaviour, and the normal case for the BRONZE (FHIR) patients whose
    // networks return nothing.
    const empty: FhirBundle = { resourceType: 'Bundle', type: 'searchset', total: 0 };

    const result = fromFhir('ppid-bronze-3', empty);

    expect(result.patientId).toBe('ppid-bronze-3');
    expect(result.sourceFormat).toBe('FHIR');
    expect(result.demographics).toEqual({
      givenName: '',
      familyName: '',
      gender: null,
      dateOfBirth: null,
    });
    expect(result.providers).toEqual([]);
    expect(result.organizations).toEqual([]);
    expect(result.encounters).toEqual([]);
    expect(result.conditions).toEqual([]);
    expect(result.medications).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.immunizations).toEqual([]);
    expect(result.labResults).toEqual([]);
  });

  it('treats a Bundle with no clinical resources as valid input, not an error', () => {
    const b = bundle([
      { resourceType: 'Patient', id: 'pat-2', name: [{ given: ['Tuma'], family: 'Nephro' }], gender: 'female' },
    ]);

    const result = fromFhir('ppid-bronze-2', b);

    expect(result.demographics.givenName).toBe('Tuma');
    expect(result.providers).toEqual([]);
    expect(result.conditions).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.immunizations).toEqual([]);
    expect(result.labResults).toEqual([]);
  });
});
