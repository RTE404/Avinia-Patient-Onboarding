# Particle Health — Exactly What Goes In, Exactly What Comes Out

This answers, with primary-source proof, two questions: (1) the minimum/complete
set of fields Particle needs to register and match a patient, and (2) the
complete, real field-by-field shape of what Particle returns — verified against
an actual sample data file in Particle's own public GitHub repo, not paraphrased
marketing docs.

---

## Part 1 — What Particle needs (input)

**Source:** [`POST /api/v2/patients` API reference](https://docs.particlehealth.com/reference/post_api-v2-patients)
(this is Particle's own OpenAPI-generated schema page — the authoritative source
for exact field names/types/requiredness)

### Required fields

| Field | Type | Notes (verbatim from docs) |
|---|---|---|
| `given_name` | string | Patient's first name |
| `family_name` | string | Patient's last name |
| `date_of_birth` | string | Must be `YYYY-MM-DD` format |
| `gender` | string | Must be `FEMALE` or `MALE` — binary only, no other value accepted |
| `address_city` | string | "The patient's home city" |
| `address_state` | string | "The patient's home state" |
| `postal_code` | string | Patient's ZIP code |
| `patient_id` | string | **This is not Particle's ID — it's your own external/internal patient identifier**, which you're required to supply and which must be unique per real person (reused IDs across different people trigger overlay-detection errors) |

That's it — **8 required fields**, 7 of which are demographic and 1 of which is
your own system's identifier. This confirms your context doc's original finding.

### Optional fields (materially improve match quality)

| Field | Type | Notes |
|---|---|---|
| `address_lines` | array of strings | Street address, excluding city/state/zip |
| `telephone` | string | Phone number |
| `email` | string | Must be a valid email address |
| `ssn` | string | Must be a valid US SSN |
| `consent` | array | Per-partner consent objects: `consent_date`, `partner` (e.g. `"Healthix"`), `permission` (`permit`/deny) — required specifically for querying Healthix (the NY HIE), not a general-purpose consent object |

### What you get back

`particle_patient_id` — a Particle-generated UUID, returned in the response,
which becomes the key for every subsequent call (query, retrieval, documents,
subscriptions).

**Bottom line on "minimum data":** Particle's hard floor is genuinely small —
name, DOB, binary gender, and a city/state/ZIP. Everything else (address lines,
phone, email, SSN) is optional but directly feeds the patient-matching/Record
Locator process described in `life-of-a-query`, so "minimum to register" and
"minimum for a good match" are two different numbers — the form can be short,
but shortness has a real match-quality cost.

---

## Part 2 — What Particle actually returns (output), field by field, with proof

Particle returns data in two shapes: **FHIR R4** (standard resources wrapped in
a `Bundle`) and **Flat** (Particle's own proprietary denormalized JSON, one array
per clinical domain). The FHIR endpoint's own OpenAPI schema is deliberately
generic — the response wrapper is documented, but the resources inside are typed
as `additionalProperties: true` because they're just standard FHIR, so Particle's
docs don't enumerate exact sub-fields there. **The Flat format is where Particle
documents its own concrete schema**, and — better than paraphrasing their docs
page (which only shows placeholder `field_1, field_2` names) — I pulled their
actual public sample dataset and inspected it directly.

**Source, verified directly, not summarized:**
[`particle-analytics-quickstarts/sample-data/flat_data.json`](https://github.com/ParticleHealth/particle-connect/blob/main/particle-analytics-quickstarts/sample-data/flat_data.json)
in Particle's own `particle-connect` GitHub repo — real (synthetic) data for
their own Gold-tier sandbox patient, **Elvira Valadez**. I downloaded this file
and enumerated every key that actually appears in it with Node.js, then pulled
one full real record per domain. This is ground truth, not documentation
paraphrase — you can re-download and re-verify it yourself.

### Every domain returned, and every field in it

**`patients`** (1 record) — `patient_id`, `given_name`, `family_name`,
`date_of_birth`, `gender`, `race`, `marital_status`, `language`,
`address_line`, `address_city`, `address_county`, `address_state`,
`address_postal_code`, `telephone`, `resource_id`

Example (real record, synthetic patient):
```json
{
  "address_city": "Boston", "address_county": "", "address_line": "703 Ankunding Trail Unit 45",
  "address_postal_code": "02215", "address_state": "Massachusetts",
  "date_of_birth": "1970-12-26T00:00:00", "family_name": "Valadez", "gender": "FEMALE",
  "given_name": "Elvira", "language": "en-US", "marital_status": "",
  "patient_id": "6f3bc061-8515-41b9-bc26-75fc55f53284", "race": "black, non-hispanic",
  "resource_id": "c4ab2954c66ab7820e00f8468f428715584cf96cca99148e8e22703969654a23", "telephone": ""
}
```
Note the empty `marital_status` and `telephone` even on the demographic record
itself — source-system gaps show up even in the "clean" fields.

**`medications`** — `medication_id`, `medication_name`, `medication_code`,
`medication_code_system`, `medication_resource_type`, `medication_reference`,
`medication_statement_id`, `medication_statement_status`,
`medication_statement_dose_value`, `medication_statement_dose_unit`,
`medication_statement_dose_route`, `medication_statement_start_time`,
`medication_statement_end_time`, `medication_statement_patient_instructions`,
`medication_statement_text`, `practitioner_role_id`, `patient_id`,
`subject_patient_id`

**`problems`** (conditions/diagnoses) — `condition_id`, `condition_name`,
`condition_code`, `condition_code_system`, `condition_category_code`,
`condition_category_code_name`, `condition_category_code_system`,
`condition_clinical_status`, `condition_onset_date`, `condition_recorded_date`,
`condition_text`, `encounter_id`, `patient_id`, `subject_patient_id`

**`encounters`** — `encounter_id`, `encounter_type_name`, `encounter_type_code`,
`encounter_type_code_system`, `encounter_start_time`, `encounter_end_time`,
`encounter_text`, `hospitalization_discharge_disposition`,
`condition_id_references`, `location_id_references`,
`practitioner_role_id_references`, `patient_id`, `subject_patient_id`

**`labs`** — `lab_observation_id`, `lab_name`, `lab_code`, `lab_code_system`,
`lab_text`, `lab_value`, `lab_value_quantity`, `lab_value_string`,
`lab_value_boolean`, `lab_value_code`, `lab_value_code_system`, `lab_unit`,
`lab_unit_quantity`, `lab_interpretation`, `lab_timestamp`,
`observation_category`, `diagnostic_report_id`, `diagnostic_report_name`,
`diagnostic_performer_practitioner_role_reference_id`,
`diagnostic_interpreter_practitioner_role_reference_id`, `patient_id`,
`subject_patient_id`

**`vitalSigns`** — `vital_sign_observation_id`, `vital_sign_observation_name`,
`vital_sign_observation_code`, `vital_sign_observation_code_system`,
`vital_sign_observation_text`, `vital_sign_observation_value`,
`vital_sign_observation_unit`, `vital_sign_observation_time`,
`vital_sign_grouping_observation_id`, `observation_category`, `patient_id`,
`subject_patient_id`

**`procedures`** — `procedure_id`, `procedure_name`, `procedure_code`,
`procedure_code_system`, `procedure_date_time`, `procedure_text`,
`procedure_reason`, `procedure_reason_code`, `procedure_reason_code_system`,
`encounter_reference_id`, `performer_practitioner_role_reference_id`,
`asserter_practitioner_role_reference_id`, `patient_id`, `subject_patient_id`

**`practitioners`** — `practitioner_id`, `practitioner_given_name`,
`practitioner_family_name`, `practitioner_name_suffix`,
`practitioner_address_street`, `practitioner_address_city`,
`practitioner_address_state`, `practitioner_address_use`,
`practitioner_identifier_system`, `practitioner_identifier_value`,
`practitioner_telecom_system`, `practitioner_telecom_value`,
`practitioner_role`, `practitioner_role_id`, `practitioner_role_code`,
`practitioner_role_code_system`, `practitioner_role_specialty`,
`practitioner_role_specialty_code`, `practitioner_role_specialty_code_system`,
`patient_id`

**`organizations`** — `organization_id`, `organization_name`,
`organization_address_lines`, `organization_address_city`,
`organization_address_state`, `organization_address_postal_code`,
`organization_address_country`, `organization_address_use`,
`organization_telecom_system`, `organization_telecom_value`,
`organization_telecom_use`, `patient_id`

**`locations`** — `location_id`, `location_name`, `location_type`,
`location_type_code`, `location_type_code_system`, `location_address`,
`location_address_use`, `location_city`, `location_state`,
`location_postal_code`, `patient_id`

**`documentReferences`** — `document_reference_id`, `document_reference_type`,
`document_reference_type_code`, `document_reference_type_coding_system`,
`document_reference_content_type`, `document_reference_content_data`,
`encounter_reference_id`, `practitioner_role_reference_id`, `patient_id`,
`subject_patient_id`

**`transitions`** (ADT/care-transition records — ties to the Signal product) —
`transition_id`, `visit_id`, `setting`, `status`, `status_date_time`,
`facility_name`, `facility_npi`, `facility_type`, `first_name`, `last_name`,
`dob`, `gender`, `address`, `city`, `state`, `zip`, `phone_number`,
`attending_physician_name`, `attending_physician_npi`,
`admitting_diagnosis_code`, `admitting_diagnosis_code_system`,
`admitting_diagnosis_code_system_name`, `admitting_diagnosis_description`,
`discharge_diagnosis_code`, `discharge_diagnosis_code_system`,
`discharge_diagnosis_code_system_name`, `discharge_diagnosis_description`,
`discharge_disposition`, `discharge_summary`, `visit_start_date_time`,
`visit_end_date_time`, `visit_diagnosis_reference_ids`,
`visit_encounter_reference_ids`, `visit_medication_reference_ids`,
`particle_patient_id`, `patient_id`

**`aIOutputs`** / **`aICitations`** (Snapshot AI-summary output + inline source
citations back to the raw record) — `ai_output_id`, `type`, `text`, `created`,
`resource_reference_ids`, `patient_id` / `citation_id`, `resource_reference_id`,
`resource_type`, `text_snippet`, `particle_patient_id`, `patient_id`

**`recordSources`** / **`sources`** (provenance — which source system each
resource came from) — `resource_id`, `resource_id_name`, `resource_type`,
`source_id`, `patient_id` / `source_id`, `source_name`, `patient_id`

**Present as domains but ZERO records for this patient** — `allergies`,
`coverages`, `familyMemberHistories`, `immunizations`, `socialHistories`. The
domain keys exist in the response structure, but this particular sandbox
patient — Particle's own flagship Gold-tier demo patient — simply has no data
in them.

**This last point is the single most important, concrete piece of evidence in
this whole research pass:** even Particle's best-case, hand-curated demo patient
comes back with empty allergy, immunization, family-history, social-history, and
insurance-coverage sections. This isn't a hypothetical limitation from a docs
disclaimer — it's directly observable in Particle's own published example data.
Build your onboarding UX and any downstream AI agent to treat these fields as
frequently absent, not as guaranteed content, and design gracefully for "we
don't have this yet" states rather than assuming a full record.

### Coding systems used inside these fields

Per [Working with Coding Systems](https://docs.particlehealth.com/docs/working-with-coding-systems),
confirmed by the real data above (e.g. `condition_code_system:
"urn:oid:2.16.840.1.113883.6.96"` = SNOMED-CT in the example record):

| Domain | Code systems used |
|---|---|
| Conditions | ICD-10-CM, ICD-10, SNOMED-CT, ICD-9-CM, local codes |
| Observations/Labs | LOINC, SNOMED-CT, local codes, Epic-specific SDOH codes |
| Medications | RxNorm, SNOMED-CT, local codes |
| Procedures | CPT-4, SNOMED-CT, LOINC, HCPCS, ICD-9-CM, local codes |
| Allergies | RxNorm, SNOMED-CT, NDF-RT, local codes |

Every domain can also carry an **HL7 Data Absent Reason** code instead of a real
value — i.e., Particle has a standard way of explicitly saying "the source
system had a field here but no value," which is a further, structural
confirmation that partial/missing data is the normal case, not the exception.

### The FHIR R4 side, for comparison

The FHIR retrieval endpoints (`GET /api/v2/patients/{id}/fhir[/{type}]`) return
a standard `Bundle` (`resourceType`, `type: "searchset"`, `total`, `entry[]` of
`{fullUrl, resource, search}`, `link[]` for pagination) wrapping the same
underlying clinical facts as the Flat domains above, but shaped as the 24
standard USCDI v2-aligned FHIR resource types documented at
[Supported FHIR Resources](https://docs.particlehealth.com/docs/supported-fhir-resources)
(full list already captured in `particle_health_integration_plan.md`). Since
FHIR resources are the actual HL7 R4 spec, their fields are whatever standard
FHIR defines for each resource type — Particle doesn't publish a
custom-narrowed field list for FHIR the way it does for Flat, so the Flat schema
above is genuinely the more precise, Particle-specific "exactly what fields
will I get" answer; use it to plan your data model even if you ultimately
request FHIR as your wire format.

---

## Sources

- [`POST /api/v2/patients` reference](https://docs.particlehealth.com/reference/post_api-v2-patients)
- [`GET /api/v2/patients/{id}/fhir` reference](https://docs.particlehealth.com/reference/get_api-v2-patients-particle-patient-id-fhir)
- [Supported FHIR Resources](https://docs.particlehealth.com/docs/supported-fhir-resources)
- [Supported Flat Data Domains](https://docs.particlehealth.com/docs/supported-flat-data-domains)
- [Working with Coding Systems](https://docs.particlehealth.com/docs/working-with-coding-systems)
- **[flat_data.json — real sample data, ParticleHealth/particle-connect repo](https://github.com/ParticleHealth/particle-connect/blob/main/particle-analytics-quickstarts/sample-data/flat_data.json)** — primary evidence for the field-by-field breakdown above, independently downloaded and parsed for this report
