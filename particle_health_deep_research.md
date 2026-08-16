# Particle Health — Deep Research Dossier

Compiled from Particle Health's public docs (docs.particlehealth.com), marketing site
(particlehealth.com), and independent reporting (Out-of-Pocket, Fierce Healthcare,
STAT News). This is a companion to `particle_health_context.md` and specifically
answers the open questions raised in that doc's Section 22.

---

## 1. Company Facts

- **Founded:** early 2018
- **Co-founders:** Troy Bannister (also long-time healthcare EMT/clinical
  researcher/investor) and Dan Horbatt
- **CEO:** Jason Prestinario (took over from founder-CEO)
- **CTO & Head of Product:** Jean Barmash
- **HQ:** 36 W 20th St, Fl 9, New York, NY 10011
- **Funding:** ~$39.3M raised total — Series A $12M (early 2020, led by Menlo
  Ventures), Series B $25M (July 2022, led by Canvas Ventures, with Menlo
  Ventures, Story Ventures, Pruven Capital)
- **Certifications:** HITRUST, SOC 2, HIPAA-compliant
- **Customers (named publicly):** Reveleer, Yuvo, Upperline Health, Hona, OSH
- **Target customers:** "tech-first" healthcare companies — digital pharmacies,
  virtual care/telehealth, chronic disease management, home care, value-based
  primary care, payers

---

## 2. What Particle Actually Is (confirms your mental model)

Particle is **not** a database of patient records — it's an aggregation/access
layer that sits on top of the real US interoperability plumbing:

- Connects to **all three Nationwide Health Information Networks (NHINs)**
  plus **TEFCA** (via CommonWell, which is Particle's Qualified Health
  Information Network / QHIN)
- Also connects to select **state/regional HIEs**: Healthix (downstate NY —
  NYC, Long Island, via SHIN-NY) and Manifest MedEx (California, strong ADT
  coverage)
- Partners with **Surescripts** for pharmacy prescription + fill data
- Claims reach of **~90% of US EHR data** / **250M–320M+ unique patients**
  across **160,000+ health organizations** (the 250M vs 320M figures appear
  in different marketing materials — treat as an approximate, moving number,
  not a hard spec)
- On average pulls ~105 records per patient search with a claimed ~90%
  match/success rate
- Does real data engineering on top of raw exchange data: patient identity
  resolution (eMPI), record validation, facility mapping, proprietary
  C-CDA→FHIR parsing, deduplication (up to ~90% reduction), gap imputation
  (claims to reduce data gaps from ~50% to ~17%)

---

## 3. Product Suite

Particle markets itself now as the **"Particle Insights Platform"** with four
solutions layered on the same core APIs:

| Product | What it does | Relevant to your use case? |
|---|---|---|
| **Workbench** | On-demand query/retrieve — register a patient, run a query, pull back FHIR/C-CDA/Flat data. This is the core developer product. | **Yes — this is what you need.** |
| **Signal** | Subscribe patients for continuous monitoring; get real-time webhooks on ADT events (admit/discharge/transfer), new discharge summaries, and new encounters. | Useful later for "notify the agent when the patient has a new visit," not needed for initial onboarding. |
| **Snapshot** | AI-generated clinical summarization (Patient History, Discharge Summary, Specialty Summary templates) from the raw aggregated data. | Potentially very useful for your AI agent — turns raw FHIR/C-CDA noise into a readable summary. Worth evaluating instead of building your own summarizer. |
| **Navigator** | Health-system-facing: understand when/where a patient sought care across the network. | Not directly relevant to a patient-facing consumer app. |

Additional named capabilities: **Particle FOCUS** (pre-curated datasets),
Specialty Search, ADT Feeds, Pharmacy data access, "TEFCA in a Box."

---

## 4. Developer API — Full Architecture

### 4.1 Authentication

- **OAuth 2.0 Client-Credentials flow**, not static API keys.
- Auth model is hierarchical: **Organization → Projects → Service Accounts →
  Credentials (Client ID/Secret) → JWT access tokens.**
- Two ways to get credentials:
  1. Ask your Particle rep to provision a client ID/secret, or
  2. Self-provision via the **Management API** (`Create Service Account`,
     `Create Credentials`).
- Token requests must include `scope=projects/{project_id}`.
- **Access tokens are valid for 60 minutes** — you must refresh.
- Every API call requires `Authorization: Bearer <token>`.
- Credentials can be rotated anytime; creating new credentials
  auto-expires old ones (with an optional `oldCredentialTtlHours`,
  0–24h, default 24, during Management-API-driven rotation).
- **Base URLs** (per public docs/Postman): production `https://api.particlehealth.com`,
  sandbox `https://sandbox.particlehealth.com` — confirm exact values in the
  Postman collection before building, since I could not verify these directly
  against a primary-source page.

### 4.2 Management API (org/account administration)

Used to set up your organization's access model:

- `POST /v1/projects` — create a Project (typically maps to a "covered
  entity" in your business)
- `POST /v1/serviceaccounts` — create a Service Account
- `POST /v1/serviceaccounts/{uuid}:setPolicy` — bind IAM roles to a service
  account, scoped to one or more projects, e.g.:
  ```json
  { "bindings": [{ "role": "roles/project.owner", "resources": ["projects/UUID_1"] }] }
  ```
- `POST /serviceaccounts/{uuid}/credentials` — issue Client ID/Secret

**IAM roles:**
- `organization.owner` — full Management API access (create SAs/projects) but
  **cannot** call the actual clinical Query APIs
- `project.owner` — full Management API within its project(s) **and** can call
  Query APIs
- `project.user` — Query APIs only, no admin

### 4.3 Patients API (Master Patient Index)

This is where your registration flow (Section 5 of your context doc) lands.

- `POST /api/v2/patients` — create or update a patient (also handles updates,
  not just creation)
- `GET /api/v2/patients/{particle_patient_id}` — retrieve/verify a patient
- `DELETE /api/v2/patients/{particle_patient_id}` — delete a patient (also
  deletes associated documents; you'd need to re-upload documents if you
  recreate the patient)
- `GET /api/v2/patients` — list all patients your org has submitted (paginated)
- `POST /api/v2/patients/search` — search/match by demographics to discover
  an existing `particle_patient_id`

**Required fields:** `given_name`, `family_name`, `date_of_birth`
(`YYYY-MM-DD`), `gender` (`FEMALE`/`MALE` — binary only, worth noting for a
patient-facing product), `postal_code`, `address_city`, `address_state` —
matches what your context doc already captured.

**Optional fields:** your own `patient_id` (must be unique — reused IDs across
different real people trigger "overlay detection" errors), `ssn`, `email`,
`telephone`, `address_lines`, a `consents` array.

**Consent array:** currently documented specifically for **Healthix** (the NY
HIE) — `consent_date`, `partner` (e.g. `"Healthix"`), `permission`
(`permit`/deny). Patient consent is *mandatory* to query Healthix
specifically; this is separate from the broader Individual Access consent
question (see §5).

### 4.4 Patient Data / Query APIs (the core retrieval flow)

Four-step lifecycle, confirming Section 12 of your context doc:

1. **Register** patient → `POST /api/v2/patients` → get `particle_patient_id`
2. **Query** → `POST /api/v2/patients/{particle_patient_id}/query` (kicks off
   the network search across Carequality/CommonWell/eHealth Exchange/HIEs)
3. **Poll status** → `GET /api/v2/patients/{particle_patient_id}/query`, or
   subscribe to a webhook instead of polling
4. **Retrieve** results in your provisioned format:
   - `GET /api/v2/patients/{particle_patient_id}/fhir` — FHIR R4
   - `GET /api/v2/patients/{particle_patient_id}/flat` — Particle's own
     simplified "Flat" JSON schema
   - `GET /api/v2/patients/{particle_patient_id}/ccda` — raw C-CDA documents

All three retrieval formats support `_since` and other filters to scope
results (this is your delta/incremental mechanism — confirms Section 12 of
your existing doc). You must be **provisioned** for a format — requesting a
format you're not licensed for returns `403 Forbidden`. Webhook retry backoff
on delivery failure: immediate → 30s → 2m → 10m → 1h.

Note: the newer v2 Patient Data API docs describe this `$query` + format-specific
GET pattern rather than a literal `$everything` FHIR operation name; the
**legacy FHIR API implementation** doc (older product surface) does describe
full R4 CapabilityStatement conformance and "support all FHIR resources and
most operations on top of them," but is explicitly called out as **legacy**.
For a new build, follow the **v2 Patient Data API** pattern, not the legacy
FHIR docs.

FHIR resources returned are a **subset** parsed out of C-CDA source
documents, not a universal FHIR store — expect gaps for anything the
source C-CDA didn't encode structurally (e.g., imaging is generally *not*
available as structured data — still often faxes/CDs at the source level).

### 4.5 Patient History API

- Endpoints follow `/history/api/v1/patients/{QUERY_ID}` — appears to be how
  you retrieve results tied to a specific historical query run (as distinct
  from the "current state" retrieval endpoints above). Treat as
  complementary to the delta/`_since` mechanism on the main retrieval
  endpoints.

### 4.6 Documents API

For **pushing** documents into Particle (relevant because of the
bi-directionality requirement below, and useful if your app collects/uploads
records the patient brings manually):

- `POST /api/v1/documents` (multipart/form-data: file + JSON metadata)
- `GET /api/v1/documents/{document_id}` — metadata
- `GET /api/v1/documents/patient/{patient_id}` — all docs for a patient
- `DELETE /api/v1/documents/{document_id}`

Required metadata: `patient_id` (must already exist in Particle's MPI —
register the patient first), `document_id`, `type` (`CLINICAL` or
`CONSENT`), `title`, `mime_type`, `creation_time` (RFC3339, no future
dates), `format_code` (IHE), `type_code`/`class_code` (LOINC),
`practice_setting_code` (SNOMED, defaults to `394733009`). Accepted MIME
types are broad (PDF, XML, JSON, HTML, CSV, JPEG/PNG/TIFF/GIF, DICOM, HL7,
Word, Excel) though the network prefers C-CDA.

### 4.7 Batch Query API

For bulk/offline processing rather than one-at-a-time interactive queries:

- `POST /api/v1/projects/{project_id}/batches` — submit an array (JSON or
  CSV) of patient demographics, query type `CCDA`/`FHIR_R4`/`FLAT`
- `GET /api/v1/projects/{project_id}/batches` / `.../batches/{batch_id}` —
  list/inspect
- Batches process asynchronously, typically within 24h during off-peak
  windows
- Limits: **production 10,000 queries/batch**, **sandbox 10 queries/batch**,
  max 3 active batches per project, 40MB request size cap

Not relevant for your real-time onboarding flow, but relevant if you ever
want to backfill a cohort of existing users.

### 4.8 Signal (webhooks / monitoring)

- Register patient → subscribe to Signal → Particle continuously watches
  NHINs/HIEs for that patient → webhook fired on: **Transition Alerts**
  (ADT: admit/discharge/transfer), **Discharge Summary Alerts**, **New
  Encounter Alerts**
- Has its own sandbox testing mode ("Testing Signal in Sandbox")
- No pricing published; commercial conversation required

### 4.9 Rate Limits & Quotas

- No fixed public numeric limits — **"limits vary by tenant"** and by
  system load
- Documented mechanic: standard bucket/TTL middleware, tracked per-minute;
  `429` on excess, safe to retry after 60s
- **Limits scale with number of Projects** — e.g., 50 req/min × 3 projects =
  150 req/min effectively, per their own example
- **Sandbox: capped at 500 queries/organization/day**

### 4.10 Sandbox / Test Patient Environment

- 200+ synthetic patients, tiered:
  - **Gold tier** (5 named patients, e.g. "Elvira Valadez-Nucleus") — richest
    data, in CCDA + Flat
  - **Bronze tier** (3 patients) — FHIR R4 `$everything`-style bundles
  - **190+ extended patients** grouped by condition (COVID, diabetes, lung
    cancer, random conditions)
- Also includes pre-built **Snapshot** templates (Patient History, Discharge
  Summary, Specialty Summary) you can test against
- Particle claims the synthetic data quality is high enough to have won an
  industry award
- All production APIs/workflows function identically in sandbox — good news
  for building your demo exactly as described in Section 19 of your context
  doc
- A **Postman collection** is publicly available
  (postman.com/particlehealth/particle-health-api) for exploring every
  endpoint hands-on

---

## 5. Purpose of Use, Consent & Individual Access — the part that matters most for your product

This directly answers Sections 7, 22.2, and 22.3 of your context doc, and is
the single most important compliance/product-architecture finding.

**Supported Purpose of Use (POU) codes:**

| POU | Consent required? | Notes |
|---|---|---|
| **Treatment** | No explicit patient consent required (HIPAA TPO) | Most broadly supported across networks. **This is the POU most apps mistakenly default to.** |
| **Payment** | No | Reimbursement/claims-related |
| **Operations** | No | Admin/quality/audit activities |
| **Individual Access** (a.k.a. Patient Access / Patient Request) | **Yes — mandatory** | The correct POU for a consumer-facing app where the *patient* is pulling their own records for their own use, not a provider pulling records to treat them. Growing support due to ONC's Anti-Information-Blocking Rule and TEFCA's Individual Access Services (T-IAS). |

**Individual Access requires two things:**
1. **Explicit consent to disclosure** from the patient
2. **Identity verification** — proof the requester is really the patient (or
   an authorized representative)

This is exactly the "Demographic matching ≠ authorization" distinction your
context doc already flagged in Section 7 — confirmed as the correct model.

**Bi-directionality policy (new finding, not in your existing doc):**
Every network Connection (i.e., you, as a Particle customer) must **both
query and respond to queries** — reciprocity is mandatory under Carequality/
CommonWell/TEFCA rules, and Particle enforces it:
- You must be able to **push your own patients' data back** into the network
  (via the Documents API) — historical records within 1 month of patient
  creation, new clinical data within 1 month of being generated
- Non-compliance risks **suspension of query access for your entire org** —
  and because Particle operates one shared gateway, misbehavior from one
  customer can jeopardize others (this is exactly the mechanism that
  triggered the Epic dispute below)
- **Practical implication for your build:** you cannot architect a "query
  only, never contribute" integration. If your AI agent app doesn't generate
  or hold any clinical documents of its own, you need a plan for what you
  push back (this is worth a direct question to your Particle rep — thin
  consumer apps with no native clinical documentation are a known friction
  point in this ecosystem).

---

## 6. The Epic v. Particle Health / Carequality Dispute (essential risk context, not in your original doc)

This is directly relevant to your project's viability and should shape how
you scope purpose-of-use and customer vetting:

- **Oct 2023:** Particle published thousands of new Carequality connections
  under the **Treatment** purpose of use.
- **Mar 21, 2024:** Epic filed a formal complaint with Carequality and
  unilaterally **suspended** the Particle Health gateway's connection to
  Epic-hosted data. Epic's claim: some of Particle's downstream customers
  were pulling patient data under a "Treatment" POU and using it for
  purposes that were **not actually treatment** (Epic cited a stark volume
  imbalance — Particle customers pulled **7M+ records** from Epic-hosted
  patients while pushing back only ~100K, evidence of one-directional,
  non-reciprocal, possibly-mis-classified use).
- **Sept 2024:** Particle Health filed an **antitrust lawsuit** against Epic,
  alleging Epic was using the dispute as pretext to kill a competitor.
- **Aug–Oct 2024:** Carequality completed a confidential investigation;
  released a redacted resolution in October. Particle agreed to a
  **corrective action plan** and **six months of additional Carequality
  oversight** to verify compliant use of purpose-of-use codes.
- The antitrust suit against Epic proceeded (judge denied Epic's motion to
  fully dismiss).

**Why this matters for your build specifically:** your product is exactly
the kind of use case at the center of this dispute — a patient-facing app
pulling broad longitudinal records outside a direct treatment relationship.
The safe, defensible architecture is:
- Use **Individual Access** POU, not Treatment, since your app is not itself
  providing treatment
- Build genuine patient identity verification + explicit consent capture
  into onboarding (which your context doc's Section 20 flow already
  anticipates — good instinct)
- Ask Particle directly, in writing, whether your specific product qualifies
  under their current (post corrective-action-plan) policies, since they are
  now under extra scrutiny for exactly this scenario

---

## 7. Pricing

- Publicly reported (via Out-of-Pocket, an independent healthcare-business
  newsletter, not Particle's own site): **~$1 per query**, with **enterprise/
  volume pricing** for larger customers.
- No official public price list — Particle's queries and Signal/Snapshot
  pricing are handled through direct sales conversations. **Treat the $1/
  query figure as a rough industry-reported anchor, not a quote** — confirm
  directly before modeling unit economics for your onboarding flow (this
  directly answers your context doc's open question 22.1).

---

## 8. Answers to Your Context Doc's Section 22 Open Questions

1. **Pricing** → ~$1/query reported publicly; get a real quote (§7 above).
2. **Individual Access qualification** → This is the correct POU for your
   use case; Particle is under active Carequality oversight specifically
   around POU misuse, so expect them to vet this carefully (§5, §6).
3. **Consent/authorization requirements** → Explicit disclosure consent +
   identity verification, two distinct steps (§5).
4. **Identity verification requirements** → Not detailed in public docs;
   this is on you to design and likely to satisfy via a third-party identity
   verification vendor (Particle doesn't appear to provide this itself) —
   needs a direct question to Particle.
5. **Exact networks/data sources** → All 3 NHINs, TEFCA (via CommonWell as
   QHIN), Carequality, CommonWell, eHealth Exchange, Healthix (NY),
   Manifest MedEx (CA), Surescripts (pharmacy) (§1, §4.4).
6. **Exact FHIR resources for patient-level retrieval** → Public docs don't
   give a definitive resource list for the current v2 API; a subset parsed
   from C-CDA. Get the exact list via the CapabilityStatement / from your
   Particle rep before scoping your Patient 360 data model.
7. **Structured FHIR vs C-CDA vs PDF** → You choose per-request: `/fhir`,
   `/flat`, or `/ccda` — but you must be *provisioned* for each format
   (§4.4). Confirm which formats your contract includes.
8. **Payer/claims data inclusion** → Not evident in current public API docs;
   the platform is clinical/pharmacy-data-centric (via NHINs/HIEs/
   Surescripts). Claims/coverage data isn't clearly documented as part of
   the core Query API — ask directly whether Coverage/ExplanationOfBenefit
   resources are actually populated, or whether that requires a separate
   payer integration as your doc's Section 21 already anticipated.
9. **Rate limits** → No fixed numbers; 429-based, per-minute, scales with
   project count; sandbox capped 500/day (§4.9).
10. **Data retention** → Not documented publicly — ask directly.
11. **HIPAA/BAA requirements** → Particle is HIPAA-compliant, SOC2, HITRUST —
    a BAA will be part of your commercial agreement; get specifics from
    their sales/legal process.
12. **Delta/incremental updates** → `_since` parameter on the FHIR/Flat/CCDA
    retrieval endpoints, plus Signal webhooks for continuous "new data
    available" notifications (§4.4, §4.8).

---

## 9. Practical Recommendation for Your Build

Given everything above, your existing plan in Section 20 of
`particle_health_context.md` is directionally correct. Two refinements
worth making before you build:

1. **Explicitly design for Individual Access POU + real consent/identity
   verification from day one** — not just because it's more correct, but
   because Particle is currently under heightened scrutiny for exactly
   this pattern of use, and you don't want to be the next Epic complaint.
2. **Ask Particle directly, early, about the bi-directionality obligation**
   for a consumer app that has no clinical documents of its own to push
   back — this is a real constraint that could affect your architecture or
   even your ability to get approved, and it isn't mentioned anywhere in
   your original context doc.

For the demo: sandbox is fully feature-complete versus production, has
200+ realistic synthetic patients across multiple tiers/conditions, a
public Postman collection, and pre-built Snapshot summary templates you
could use directly to shortcut the "make raw FHIR/C-CDA readable for an AI
agent" problem.

---

## Sources

- [Introduction to Particle Health](https://docs.particlehealth.com/docs/introduction-to-particle-health)
- [Getting Started for Developers](https://docs.particlehealth.com/docs/getting-started-for-developers)
- [Auth & Keys](https://docs.particlehealth.com/docs/auth-and-keys)
- [Patients API](https://docs.particlehealth.com/docs/patients-api)
- [Patient Data APIs](https://docs.particlehealth.com/docs/patient-data-apis)
- [Patient History APIs](https://docs.particlehealth.com/docs/patient-history-apis)
- [Documents API](https://docs.particlehealth.com/docs/documents-api)
- [Management APIs](https://docs.particlehealth.com/docs/management-apis)
- [Batch Query API](https://docs.particlehealth.com/docs/batch-query-api)
- [Particle Signal](https://docs.particlehealth.com/docs/particle-signal)
- [Purposes of Use](https://docs.particlehealth.com/docs/purposes-of-use)
- [Bi-Directionality Policy](https://docs.particlehealth.com/docs/bi-directionality-policy)
- [Rate Limiting & Quotas](https://docs.particlehealth.com/docs/rate-limiting-and-quotas)
- [Test Patient Sandbox](https://docs.particlehealth.com/docs/test-patient-sandbox)
- [Legacy FHIR API Implementation](https://docs.particlehealth.com/docs/legacy-fhir-api-implementation)
- [Particle Health homepage](https://www.particlehealth.com/)
- [About Us](https://www.particlehealth.com/about-us)
- [Particle Health And Pulling Patient Data — Out-of-Pocket](https://www.outofpocket.health/p/particle-health-and-pulling-patient-data)
- [Particle Health's antitrust lawsuit against Epic moves forward — Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/particle-healths-antitrust-lawsuit-against-epic-moves-forward-after-judge-dismisses)
- [Epic Systems v. Particle: What the Carequality investigation reveals — STAT News](https://www.statnews.com/2024/10/09/epic-systems-particle-health-antitrust-dispute-carequality/)
- [Particle Health Raises $25 Million — company blog](https://www.particlehealth.com/blog/series-b-25-million-interoperability)
