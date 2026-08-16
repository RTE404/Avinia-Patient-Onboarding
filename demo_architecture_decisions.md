# Patient Onboarding Demo — Architecture Decisions Log

Running log of decisions made during design discussion, most recent last. This is
the single place to check "what have we actually decided" without digging through
the individual research docs. Supersedes anything in other docs that conflicts —
those stay as the detailed research backing each decision.

## Scope
- **Module scope:** patient onboarding only, not the broader app.
- **Demo, not production:** prototype against Particle's sandbox first (synthetic
  patients, no real PHI, no BAA/contract needed yet). Swap in production
  credentials later without redesigning.
- **No persistent storage.** The demo proves "collect minimal data + verify
  identity → use an aggregator to fetch all available US records" — it doesn't
  need to own a Patient 360 store. (Revisit Medplum as a foundation — see
  `particle_health_vs_medplum.md` — once a later phase needs real storage.)
- **Identity verification:** included in scope conceptually, but **mocked/simulated**
  for this demo rather than integrating a real IDV vendor.
- **Form factor:** web app (frontend + backend), not just a CLI/API demo.

## Data source
- **Aggregator: Particle Health** — chosen over Health Gorilla (active
  unresolved fraud lawsuit as of Jan 2026), Metriport (promising IAS model but
  unproven small company — worth a future parallel eval), Zus/1upHealth/Redox/
  CareEvolution (ruled out, wrong purpose-of-use model or wrong architecture).
  See `health_data_aggregator_comparison.md`.
- **Purpose of use: `INDIVIDUAL_ACCESS`**, not Treatment — this is the
  legally/architecturally correct choice for a patient-self-service app, and the
  one Particle is under the most scrutiny to get right post-Epic-dispute. Requires
  consent-to-disclosure + identity verification (mocked for the demo, real
  IDV vendor deferred to production).
- **No Medplum (or equivalent) for this phase** — not needed without storage.
  Revisit as the foundation once the app needs to actually own a Patient 360.

## Sandbox patient population
- **All 8 confirmed Tier 1 sandbox patients** (not just the 3 FHIR-capable
  ones): 5 Gold (`-Nucleus` names) + 3 Bronze (Hart Fallon, Tuma Nephro, Grant
  Bogisich). Exact registration payloads in `particle_sandbox_patient_picklist.json`.
- **Not using** the Synthea `fhir/` folder that was staged locally — it was never
  registered in Particle's sandbox network, so querying against those
  demographics returns nothing. Not part of the integration path.
- **Tier 2 (136 "extended" patients)** — demographics published by Particle but
  live-API queryability unconfirmed. Spot-check before relying on any of them;
  not part of the guaranteed demo path.

## Data format
- **Branch per tier, not a single unifying format:**
  - Gold patients → `GET /api/v2/patients/{id}/flat`
  - Bronze patients → `GET /api/v2/patients/{id}/fhir`
  - No CCDA parsing layer for the demo (CCDA was the only format all 8 share,
    but requires owning real XML parsing — not worth it for two extra code
    paths' worth of savings).
- Internal representation fed to the UI must be **format-agnostic** across Flat
  JSON and FHIR R4 — this normalization step is a required component, not
  optional. Field-by-field shape of both formats: `particle_health_field_by_field.md`.

## Query-timing UX
- **Primary demo path: pre-fetch/cache.** Since the demo uses a small, fixed set
  of known sandbox patients, run their queries once ahead of time and cache the
  results; the "live" demo calls a fast path that returns pre-fetched data
  instantly.
- **Secondary mode: live polling with a progress UI**, showing the real
  ~3-5 minute async query lifecycle for anyone who wants to see it actually
  happen rather than the cached fast path. No webhook infrastructure for the
  demo (would need a public callback URL — not worth the setup for a fixed
  patient list); polling is sufficient for this secondary mode.

## Tech stack
- **TypeScript** across the board. **React** for the UI, as a **separate**
  frontend (not folded into a framework like Medplum — Medplum stays a
  possible future foundation for the post-demo storage-owning phase, not a
  driver of this stack choice).
