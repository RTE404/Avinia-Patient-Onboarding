import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { FhirBundle, FhirResource } from '../retrieve.js';

function resourcesOfType(bundle: FhirBundle, type: string): FhirResource[] {
  return bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === type);
}

function codingDisplay(codeableConcept: any): string | null {
  if (!codeableConcept) return null;
  if (typeof codeableConcept.text === 'string' && codeableConcept.text.trim() !== '') {
    return codeableConcept.text;
  }
  const coding = codeableConcept.coding?.[0];
  return coding?.display ?? coding?.code ?? null;
}

function referenceId(reference: string | undefined): string | null {
  if (!reference) return null;
  return reference.split('/').pop() ?? null;
}

export function fromFhir(patientId: string, bundle: FhirBundle): NormalizedPatientRecord {
  const patient = resourcesOfType(bundle, 'Patient')[0] ?? {};
  const name = (patient as any).name?.[0] ?? {};

  const practitioners = resourcesOfType(bundle, 'Practitioner');
  const practitionerRoles = resourcesOfType(bundle, 'PractitionerRole');
  const organizations = resourcesOfType(bundle, 'Organization');
  const encounters = resourcesOfType(bundle, 'Encounter');
  const conditions = resourcesOfType(bundle, 'Condition');
  const medicationStatements = resourcesOfType(bundle, 'MedicationStatement');
  const medicationRequests = resourcesOfType(bundle, 'MedicationRequest');
  const allergies = resourcesOfType(bundle, 'AllergyIntolerance');
  const immunizations = resourcesOfType(bundle, 'Immunization');
  const observations = resourcesOfType(bundle, 'Observation');

  return {
    patientId,
    sourceFormat: 'FHIR',
    demographics: {
      givenName: name.given?.[0] ?? '',
      familyName: name.family ?? '',
      gender: (patient as any).gender ?? null,
      dateOfBirth: (patient as any).birthDate ?? null,
    },
    providers: practitioners.map((p: any) => {
      const role = practitionerRoles.find(
        (r: any) => referenceId(r.practitioner?.reference) === p.id,
      );
      const pName = p.name?.[0] ?? {};
      return {
        id: p.id ?? '',
        givenName: pName.given?.[0] ?? '',
        familyName: pName.family ?? '',
        specialty: role ? codingDisplay((role as any).specialty?.[0]) : null,
      };
    }),
    organizations: organizations.map((o: any) => ({
      id: o.id ?? '',
      name: o.name ?? '',
      city: o.address?.[0]?.city ?? null,
      state: o.address?.[0]?.state ?? null,
    })),
    encounters: encounters.map((e: any) => ({
      id: e.id ?? '',
      typeName: codingDisplay(e.type?.[0]),
      startTime: e.period?.start ?? null,
      endTime: e.period?.end ?? null,
      providerId: referenceId(e.participant?.[0]?.individual?.reference),
    })),
    conditions: conditions.map((c: any) => ({
      id: c.id ?? '',
      name: codingDisplay(c.code) ?? 'Unknown condition',
      code: c.code?.coding?.[0]?.code ?? null,
      clinicalStatus: codingDisplay(c.clinicalStatus),
      onsetDate: c.onsetDateTime ?? null,
    })),
    medications: [...medicationStatements, ...medicationRequests].map((m: any) => ({
      id: m.id ?? '',
      name: codingDisplay(m.medicationCodeableConcept) ?? 'Unknown medication',
      code: m.medicationCodeableConcept?.coding?.[0]?.code ?? null,
      status: m.status ?? null,
      doseValue: m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value != null
        ? String(m.dosage[0].doseAndRate[0].doseQuantity.value)
        : null,
      doseUnit: m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit ?? null,
      doseRoute: codingDisplay(m.dosage?.[0]?.route),
    })),
    allergies: allergies.map((a: any) => ({
      id: a.id ?? '',
      substance: codingDisplay(a.code) ?? 'Unknown substance',
      reaction: codingDisplay(a.reaction?.[0]?.manifestation?.[0]),
      severity: a.reaction?.[0]?.severity ?? null,
    })),
    immunizations: immunizations.map((i: any) => ({
      id: i.id ?? '',
      name: codingDisplay(i.vaccineCode) ?? 'Unknown immunization',
      date: i.occurrenceDateTime ?? null,
    })),
    labResults: observations
      .filter((o: any) => o.category?.[0]?.coding?.[0]?.code === 'laboratory')
      .map((o: any) => ({
        id: o.id ?? '',
        name: codingDisplay(o.code) ?? 'Unknown lab',
        value: o.valueQuantity?.value != null ? String(o.valueQuantity.value) : (o.valueString ?? null),
        unit: o.valueQuantity?.unit ?? null,
        interpretation: codingDisplay(o.interpretation?.[0]),
        timestamp: o.effectiveDateTime ?? null,
      })),
  };
}
