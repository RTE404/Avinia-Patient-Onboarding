# Avinia — Patient Onboarding

Research and design for the patient onboarding module of a larger healthcare
app. This module handles collecting minimal patient information (via ID
document + manual fields) and using Particle Health, a US healthcare data
aggregator, to automatically retrieve the patient's available longitudinal
medical history — no manual document upload required.

## Current status

Design phase complete for a sandbox-only demo (no real PHI, no persistent
storage). Implementation plan not yet written.

## Reading order

**Decisions & design (start here):**
1. [`demo_architecture_decisions.md`](demo_architecture_decisions.md) — running log of every decision made and why. Check this first for current state.
2. [`demo_design_spec.md`](demo_design_spec.md) — the actual design: components, data flow, module structure, error handling, testing.

**Particle Health research (backing the decisions above):**
- [`particle_health_context.md`](particle_health_context.md) — US healthcare interoperability primer (FHIR, HIEs, Carequality, CommonWell, TEFCA, QHINs) and the original Patient 360 concept.
- [`particle_health_deep_research.md`](particle_health_deep_research.md) — company background, product suite, API architecture, purpose-of-use/consent model, the Epic/Carequality dispute, pricing.
- [`particle_health_integration_plan.md`](particle_health_integration_plan.md) — concrete integration plan: real FHIR resource coverage vs. gaps, format tradeoffs, end-to-end flow.
- [`particle_health_field_by_field.md`](particle_health_field_by_field.md) — verified, field-by-field input/output schema, sourced from Particle's real public sample data.
- [`particle_health_vs_medplum.md`](particle_health_vs_medplum.md) — why Particle isn't an app framework, and how it'd combine with something like Medplum later.
- [`health_data_aggregator_comparison.md`](health_data_aggregator_comparison.md) — Particle vs. Health Gorilla, Metriport, Zus, 1upHealth, Redox, CareEvolution, and why Particle was chosen.
- [`particle_sandbox_patient_picklist.md`](particle_sandbox_patient_picklist.md) / [`.json`](particle_sandbox_patient_picklist.json) — the exact sandbox test patients this demo uses, with ready-to-use registration payloads.

## Next step

Write an implementation plan from `demo_design_spec.md` before any code is
written.
