# Does Particle Health Have a Medplum-Equivalent Framework?

**Short answer: no — and it's not really a fair comparison, because Particle and
Medplum aren't the same category of product.** Particle is a data source; Medplum
is an application framework you build on. The two compose together rather than
compete.

---

## What Particle Health actually has on GitHub

Org: [github.com/ParticleHealth](https://github.com/ParticleHealth), 16 repos.
Most are internal infrastructure tooling not meant for customers (Terraform
modules for their own GCP setup, protobuf/FHIR-proto forks, a WSDL codegen tool,
a Go structured-logging package). Three are genuinely relevant to a customer
building an app:

- **[particle-connect](https://github.com/ParticleHealth/particle-connect)** —
  the closest thing to a starter kit. Contains a Python SDK + quickstart scripts
  (auth, patient registration, clinical data retrieval, ADT subscriptions,
  credential management), an analytics pipeline (loads Flat data into
  DuckDB/BigQuery with 15 prebuilt SQL queries), and a small React+FastAPI admin
  UI for managing projects/service accounts/credentials. **Explicitly labeled
  "not production-ready"** — learning material and reference patterns, GitHub
  issues aren't even monitored. Worth reading through for real request/response
  shapes and auth flow examples, not worth building your actual app on top of.
- **[ccda-parser](https://github.com/ParticleHealth/ccda-parser)** — Python
  C-CDA spec parser/class generator. Genuinely useful utility if you ever need
  to parse raw C-CDA yourself instead of relying on Particle's FHIR conversion.
- **[synthetic-patients-ccdas](https://github.com/ParticleHealth/synthetic-patients-ccdas)**
  — open-sourced synthetic C-CDA test patients, useful as test fixtures
  independent of hitting the sandbox API.

None of this is an application framework. There's no datastore, no auth/identity
system, no UI component library, no persistence layer — it's SDK glue and
reference scripts around Particle's own API.

---

## What Medplum actually is (why it's not the same thing)

Medplum is a full **open-source, FHIR-native backend + frontend platform**
(Apache 2.0) — a production-grade FHIR datastore, auth/access-control system, a
"Bots" automation layer (serverless functions triggered by FHIR resource
changes), and a React component library that covers most common clinical UI
workflows. You self-host it or use their hosted version, and you build your
actual product's data model, UI, and automation logic on top of it. It's the
category Particle simply doesn't compete in — Medplum is infrastructure for
*owning and serving* clinical data; Particle is a service for *finding and
retrieving* it from the rest of the US healthcare system.

---

## The pattern that actually matters: they're meant to be combined

Medplum Enterprise **explicitly supports connecting to Carequality and
CommonWell directly**, and — more usefully — there's a **documented, real
integration between Medplum and Metriport** (one of the Particle alternatives
from our earlier comparison) using a clean two-bot pattern:

- **Outbound bot**: triggered when a Medplum `Patient` resource is
  created/updated → calls the aggregator's API to register the patient and kick
  off a query (aggregator Facility/Project IDs stored as identifiers on the
  Medplum `Organization` resource)
- **Inbound bot**: a webhook receiver that the aggregator calls back when the
  query completes → parses the returned FHIR Bundle → upserts each resource
  (Patient, Condition, Observation, MedicationStatement, etc.) into Medplum's
  own FHIR store, with Medplum handling auth, dedup/versioning, and
  access-control from there

This pattern **transfers directly to Particle Health** — same shape, same
FHIR-in/FHIR-out interface, same async webhook-driven completion. Nobody has
published a Medplum+Particle integration specifically, but there's nothing
Particle-specific that would block it; it's the same "outbound bot registers +
queries, inbound bot receives webhook + upserts FHIR resources" shape as the
Metriport one, adapted to Particle's actual endpoints
(`POST /api/v2/patients`, `POST .../query`, webhook → `GET .../fhir`).

---

## What this means for our onboarding module

Given we already decided this demo phase needs **no persistent storage**, you
don't strictly need Medplum (or anything like it) for the demo itself — a thin
backend that calls Particle directly and displays the returned bundle is enough
to prove the concept.

But it's worth naming now because it directly answers a question the bigger app
will eventually face: once this module needs to *own* a real Patient 360 (store
it, expose it to the AI agent, handle consent/access-control on it, support a
provider-facing UI later) — that's exactly the job Medplum is built for, and
Particle would plug into it as one bot pair among possibly several data sources,
rather than the app being built as bespoke plumbing around Particle's raw API.
Worth keeping in mind as a candidate foundation once we're past the storage-free
demo and into the real "Patient 360" phase.

---

## Sources

- [ParticleHealth GitHub org](https://github.com/orgs/ParticleHealth/repositories)
- [particle-connect](https://github.com/ParticleHealth/particle-connect)
- [ccda-parser](https://github.com/ParticleHealth/ccda-parser)
- [synthetic-patients-ccdas](https://www.particlehealth.com/blog/synthetic-clinical-data)
- [Medplum — Why Medplum Is Open Source](https://www.medplum.com/open-source)
- [Medplum Enterprise (Carequality/CommonWell support)](https://www.medplum.com/enterprise)
- [Connecting Medplum with Metriport — Vinta Software](https://www.vintasoftware.com/blog/medplum-metriport-api-integration)
