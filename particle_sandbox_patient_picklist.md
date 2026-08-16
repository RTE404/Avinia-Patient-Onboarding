# Particle Sandbox — Demo Patient Picklist

Companion to `particle_sandbox_patient_picklist.json` (same folder) — that file has
the exact, ready-to-`POST`, machine-generated registration payloads for every
patient below. This replaces the Synthea `fhir/` folder as the source of "patients
whose records the Particle API would fetch" for the demo — see the earlier
discussion for why the Synthea data can't work for that (Particle's sandbox
network has never heard of those patients, so a query against them returns
nothing).

**Everything in the JSON file was machine-parsed directly from Particle's own
published table** at
[Test Patient Sandbox](https://docs.particlehealth.com/docs/test-patient-sandbox),
not hand-transcribed — I wrote a small script against the raw doc markdown to
avoid copy errors across 144 rows.

---

## Two tiers — read this before picking patients for the demo

### Tier 1 — CONFIRMED (8 patients)

These are the only patients Particle's docs give **explicit, step-by-step API
instructions** for — register → query → retrieve, with named endpoints. Safe to
build the demo's guaranteed path on.

| Name | Product tier | Formats available | `patient_id` |
|---|---|---|---|
| Elvira Valadez-Nucleus | Gold | FLAT & CCDA only | `test-001` |
| Glynda Sugarman-Nucleus | Gold | FLAT & CCDA only | `test-002` |
| Freda Quently-Nucleus | Gold | FLAT & CCDA only | `test-003` |
| Kam Quark-Nucleus | Gold | FLAT & CCDA only | `test-004` |
| Artie Jointson-Nucleus | Gold | FLAT & CCDA only | `test-005` |
| **Hart Fallon** | Bronze | **FHIR® & CCDA** | `test-007` |
| **Tuma Nephro** | Bronze | **FHIR® & CCDA** | `test-012` |
| **Grant Bogisich** | Bronze | **FHIR® & CCDA** | `test-008` |

**Since we already decided FHIR R4 is our target format, our real usable demo
population is just the 3 Bronze patients** (Hart Fallon, Tuma Nephro, Grant
Bogisich) — the 5 Gold ones don't support FHIR at all, only Flat/CCDA. Worth
sitting with: a FHIR-based demo has exactly **3** guaranteed-working patients out
of the box.

Retrieval for these three, per the docs:
```
GET /api/v2/patients/{particle_patient_id}/fhir   (recommended, returns $everything bundle)
```
after the normal register → query → wait-for-completion flow.

### Tier 2 — UNCONFIRMED (136 patients)

This is the larger "Condition Data Set" table from the same doc page (Covid,
Diabetes, Lung Cancer, Random Condition, and "Original Sandbox Data" cohorts —
all Massachusetts-based). It has full demographics for each patient and a
documented CCDA file count, but I could **not independently confirm these are
live-queryable through the Sandbox API** the same way the 8 named patients are:

- The doc page presents this table under a "Particle's GitHub Repository"
  heading, but I checked the actual `synthetic-patients-ccdas` repo directly and
  it **only contains 5 patient folders** (the same 5 Gold/Bronze names above,
  minus Elvira and Kam) — not 136. So this table doesn't correspond to a public
  downloadable CCDA set either.
- Nothing in Particle's docs explicitly states "register and query these 136 via
  the live API and expect results," the way it does for the 8 named ones.

**Don't build the core demo path on these without testing first.** Before relying
on any Tier 2 patient, register + query 2-3 of them for real against the sandbox
and confirm you get non-empty results back — treat it as a quick verification
step, not an assumption. If they do work, this tier is a great source of variety
(different conditions, different ages, larger sample) layered on top of the
guaranteed Tier 1 core. If they don't, at least the demo's critical path was
never depending on them.

---

## Decision: use all 8 Tier 1 patients, not just the 3 FHIR-capable ones

Superseded the earlier narrower recommendation — the demo will use all 8
confirmed patients, which means it must handle **two different source formats
depending on which patient was selected**:

- **5 Gold patients** (`-Nucleus` names) → **FLAT & CCDA only**, no FHIR
- **3 Bronze patients** (Hart Fallon, Tuma Nephro, Grant Bogisich) → **FHIR® & CCDA**

**Decided:** branch retrieval per tier — `GET .../flat` for the 5 Gold patients,
`GET .../fhir` for the 3 Bronze patients. No CCDA parsing layer needed for the
demo. Whatever internal representation the app uses to hand data to the
UI/agent needs to be format-agnostic across these two source shapes (see
`particle_health_field_by_field.md` for the real Flat field list per domain, and
`particle_health_integration_plan.md` for the 24-resource FHIR list) — this
normalization step is now a required architecture component, not optional.

Tier 2 (136 unconfirmed patients) guidance is unchanged: spot-check before
depending on any of them.
