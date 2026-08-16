# Avinia — Patient Onboarding

Research and design for the patient onboarding module of a larger healthcare
app. This module handles collecting minimal patient information (via ID
document + manual fields) and using Particle Health, a US healthcare data
aggregator, to automatically retrieve the patient's available longitudinal
medical history — no manual document upload required.

## Current status

Implementation complete. All 12 tasks of
[`docs/superpowers/plans/2026-08-17-patient-onboarding-demo.md`](docs/superpowers/plans/2026-08-17-patient-onboarding-demo.md)
are done and the full workspace test suite passes (`npm test` at the repo
root). The result is a sandbox-only demo — no real PHI, no persistent
storage, no database; consent lives in an in-memory store and retrieved
records are cached as JSON files on disk.

The monorepo has four workspaces:

| Package | What it is |
| --- | --- |
| `packages/shared` | Shared types and the fixed list of 8 Particle sandbox patients |
| `packages/api` | Express API: demographics, consent, cached/live record retrieval, Particle client and normalizers |
| `packages/web` | React frontend: patient picker → mocked IDV → consent → results |
| `packages/scripts` | One-off prefetch script that warms the record cache |

## Quick Start

> **You need real Particle Health sandbox credentials for this demo to show
> any medical records at all.** See "Credentials are required" below before
> you start — this is not optional and there is no offline fixture mode.

```bash
# 1. Install (workspaces — run from the repo root)
npm install

# 2. Configure credentials
cp .env.example .env
#    then edit .env and fill in PARTICLE_CLIENT_ID / PARTICLE_CLIENT_SECRET

# 3. Warm the cache — once, after credentials exist.
#    Runs the full register → query → poll → retrieve → normalize flow for
#    all 8 sandbox patients and writes packages/api/src/cache/<patient_id>.json.
#    Expect this to take a while: each patient's query takes minutes.
npm run prefetch --workspace packages/scripts

# 4. Run the two dev servers, in separate terminals
npm run dev --workspace packages/api    # http://localhost:4000
npm run dev --workspace packages/web    # http://localhost:5173

# Tests (all workspaces)
npm test
```

Then open the Vite URL, pick a patient, click through the mocked identity
verification and the consent screen, and the results page renders that
patient's normalized history.

### Credentials are required

**Without real Particle sandbox credentials in `.env`, the demo cannot show
any medical records.** Concretely, with an empty `.env`:

- Patient selection, the mocked identity-verification step and the consent
  step all work — they never touch Particle.
- The results step does not. With no prefetched cache file for the patient,
  the API transparently falls back to a live Particle query, which fails
  immediately with `PARTICLE_CLIENT_ID and PARTICLE_CLIENT_SECRET must be
  set`. The frontend surfaces that as an error on the results screen.

The cache-first design is what makes the demo feel instant, but it only pays
off *after* step 3 above has been run successfully at least once — the cache
is populated exclusively by real Particle responses. `packages/api/src/cache/`
ships empty, and cached records are the only way to see results without
waiting several minutes for a live query.

The credentials come from a Particle Health account (`PARTICLE_CLIENT_ID`,
`PARTICLE_CLIENT_SECRET`, and optionally `PARTICLE_SCOPE`); see
[`.env.example`](.env.example). `.env` is git-ignored.

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

**Implementation:**
- [`docs/superpowers/plans/2026-08-17-patient-onboarding-demo.md`](docs/superpowers/plans/2026-08-17-patient-onboarding-demo.md) — the implementation plan the code was built from, task by task.
