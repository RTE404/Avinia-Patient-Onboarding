# Particle Health — Integration Plan for the Patient Onboarding / Patient 360 AI Agent

This is the "how do I actually use this" companion to `particle_health_context.md`
(your original mental model) and `particle_health_deep_research.md` (the general
company/API dossier). This document maps Particle's real API surface directly onto
your proposed application: patient onboarding → Patient 360 → doctor-appointment AI
agent.

---

## 1. Reality-check: what Particle can actually give your Patient 360

Your context doc's Section 11 wish-list included Encounter, Condition, Observation,
DiagnosticReport, Procedure, MedicationRequest, MedicationDispense,
AllergyIntolerance, Immunization, Practitioner, Organization, DocumentReference,
Coverage, and ExplanationOfBenefit. Particle's **actual documented list of 24
supported FHIR resources** (parsed out of C-CDA, per
[Supported FHIR Resources](https://docs.particlehealth.com/docs/supported-fhir-resources)) is:

```
AllergyIntolerance   Basic              CarePlan          Composition
Condition            Coverage           Device            DiagnosticReport
DocumentReference    Encounter          FamilyMemberHistory  Immunization
Location             Medication         MedicationRequest MedicationStatement
Observation          Organization       Patient           Person
Practitioner         PractitionerRole   Procedure         RelatedPerson
```

**Gap analysis against your Patient 360 wish-list:**

| You wanted | Status |
|---|---|
| Encounter, Condition, Observation, DiagnosticReport, Procedure, MedicationRequest, AllergyIntolerance, Immunization, Practitioner, Organization, DocumentReference | **✅ Supported** |
| Medication fills (MedicationDispense) | **⚠️ Not in the list.** You get `MedicationStatement` (medication history, described as *more common* than MedicationRequest) instead — treat this as your primary "what is the patient taking" signal, not a literal pharmacy fill/dispense record. |
| Coverage (insurance) | **✅ In the list, but low-frequency today** — Particle's own docs say they "do not receive this information with high frequency," expecting improvement as USCDI/TEFCA mandates tighten. Don't build a UX that assumes coverage will reliably populate. |
| Claim / ExplanationOfBenefit | **❌ Not supported.** Confirms your context doc's Section 21 instinct — claims/EOB data needs a **separate payer integration**, not Particle. Particle is a clinical-network aggregator, not a claims clearinghouse. |
| CareTeam | **❌ Not a distinct resource** — `PractitionerRole` is the closest substitute (links a Practitioner to an Organization/role) but isn't a full "care team" construct. |
| Family/social history | **Family:** ✅ `FamilyMemberHistory`. **Social history:** not in the list — typically embedded as free-text/`Observation` inside C-CDA social-history sections rather than a distinct resource; expect to mine it from C-CDA/Composition or Snapshot output rather than a clean structured field. |
| Care plans | **✅ CarePlan** |
| Appointment, Consent, Provenance, ImagingStudy | **❌ None supported.** Confirms imaging stays outside the API (per the Out-of-Pocket reporting: imaging is "still faxes/CD-ROMs" at the source level in a lot of cases). Don't design a feature around pulling imaging studies through this API. |

**Practical implication:** Build your Patient 360 schema around the 24 resources
above as ground truth, not your original aspirational list. For coverage/claims,
plan a separate payer-API workstream from day one rather than treating Particle as
a one-stop shop.

---

## 2. Format choice: FHIR vs C-CDA vs Flat — with real timing data

New data point not in the original research: Particle documents actual latency.

| Format | Speed (documented) | Parsing effort | When to use |
|---|---|---|---|
| **C-CDA** | ~80% of queries complete in **~3 minutes** | High — hundreds of pages of XML per patient, you own the parsing | Fast initial retrieval, or if you want the raw source-of-truth document to archive/display "original record" |
| **FHIR R4** | ~80% complete in **~5 minutes** | Low — structured JSON resources, server already normalized it | **Recommended for your app** — you know exactly which resources you want (the 24 above), and your AI agent needs structured data, not XML parsing |
| **Flat** | Not benchmarked in docs | Lowest — Particle's own simplified JSON | Good for quick prototyping/demo UI, but likely less expressive than full FHIR for an AI agent that needs resource-level structure (e.g., distinguishing Condition vs Observation) |

**Recommendation for your app:** Request **FHIR R4** as your primary format. It's
the best match for feeding structured facts to an LLM-based agent (you can chunk by
resource type, cite dates/sources per resource, etc.), and the 2-minute latency
delta vs C-CDA doesn't matter for an onboarding flow that's already asynchronous
(see §4). Keep C-CDA retrieval available as a fallback/archival copy since you're
required to be able to push data back under bi-directionality anyway (§6).

---

## 3. End-to-end flow mapped to your onboarding UX

Your context doc's Section 20 flow is directionally right. Here it is with actual
endpoints and realistic timing wired in:

```
[Patient-facing onboarding UI]
        |
        v
Collect demographics (first/last name, DOB, gender, address, city,
state, ZIP, phone, email, optional SSN)
        |
        v
Identity verification  <-- your own IDV vendor; Particle does not do this
        |
        v
Explicit consent capture (Individual Access disclosure consent — §6)
        |
        v
POST /api/v2/patients                       → particle_patient_id
        |
        v
POST /api/v2/patients/{id}/query             → query_id, purpose=INDIVIDUAL_ACCESS
        |
        v
   [ASYNC — 3-5 min typical] ---------------------------+
        |                                                |
        v                                                v
Show "gathering your medical history..."       Webhook fires:
state in the UI (don't block signup on this)   com.particlehealth.api.v2.query
        |                                       status=COMPLETE
        |                                                |
        +<-----------------------------------------------+
        |
        v
GET /api/v2/patients/{id}/fhir                → FHIR R4 Bundle (24 resource types)
        |
        v
Normalize into your Patient 360 store
        |
        v
[Optional] POST to Particle Snapshot for AI-generated
Patient History / Discharge Summary templates
        |
        v
Doctor-appointment AI agent reads from your normalized store
```

**Key UX decision:** because query completion realistically takes minutes, don't
gate account creation on it. Let the patient finish onboarding immediately, kick
the query off in the background, and surface "your medical history is ready" as a
follow-up notification/state change — driven by the webhook, not polling.

**Use webhooks, not polling**, for query completion in production. Docs describe
retry escalation (immediate → 30s → 2m → 10m → 1h) plus a documented CloudEvents
payload:

```json
{
  "specversion": "1.0",
  "id": "...",
  "type": "com.particlehealth.api.v2.query",
  "time": "...",
  "data": {
    "particle_patient_id": "...",
    "external_patient_id": "...",
    "query_id": "...",
    "status": "COMPLETE",
    "purpose": "INDIVIDUAL_ACCESS",
    "file_count": 12
  }
}
```

Verify authenticity via the `x-ph-signature-256` header (`t=timestamp,sig` —
HMAC-SHA256 over `timestamp.body`, with the signature key issued when you register
your webhook URL with your Particle rep). Support multiple concurrent valid
signatures during key rotation.

---

## 4. Query internals worth knowing (affects reliability expectations)

Per [Life of a Query](https://docs.particlehealth.com/docs/life-of-a-query), a
single query fans out into **hundreds of sub-queries** to individual network
partners, each doing patient-ID match → document discovery → document retrieval,
followed by a **Record Validator** step that re-checks demographics against
returned documents to catch mismatches before the data ever reaches you. This is
good news for data quality (Particle is actively guarding against giving you the
wrong person's records) but explains why match quality is highly sensitive to how
complete/accurate the demographics you collect are — reinforces why your
onboarding form should push for as many optional fields (phone, email, SSN if
justified) as you can reasonably collect, exactly as your context doc already
concluded.

---

## 5. Where Snapshot fits your AI agent specifically

Rather than having your own agent ingest 24 raw FHIR resource types cold,
**Particle Snapshot** produces pre-built AI summaries (Patient History, Discharge
Summary, Specialty Summary) from the same underlying aggregated data. For a
doctor-appointment-prep agent, this is worth prototyping against directly in
sandbox (the test patients already have Snapshot templates available) before you
invest in building your own summarization layer on raw FHIR — it may cover your
"give the doctor/agent a readable history" need out of the box, with your own
agent then only needing to do appointment-specific reasoning on top rather than
raw clinical NLP.

---

## 6. Purpose of Use decision — concrete for your app

Use **`INDIVIDUAL_ACCESS`** as the purpose of use on every query
(`POST /api/v2/patients/{id}/query`), not `TREATMENT`. This is the load-bearing
compliance decision for your whole product (see the Epic/Carequality dispute
context already captured in project memory) — your app is not itself delivering
treatment, so Treatment POU is both technically wrong and the exact pattern
Particle is now under extra Carequality scrutiny for.

Required before you can legitimately use Individual Access:
1. **Consent to disclosure** — explicit, documented, patient-initiated
2. **Identity verification** — Particle does not provide this; you need a
   third-party IDV vendor (e.g., ID-document + liveness check) in your onboarding
   flow before the consent step

Both should be logged with timestamps as part of your patient record — you will
likely need to produce evidence of this if Particle or Carequality ever audits
your usage pattern (not hypothetical — this happened to real Particle customers
in the 2024 dispute).

---

## 7. Bi-directionality — concrete plan needed

You are obligated to push data back into the network for any patient you query
(historical data within 1 month of patient creation, new data within 1 month of
generation), via `POST /api/v1/documents`. For a pure consumer app that doesn't
generate its own clinical documentation, work out one of these with your Particle
rep **before committing to the integration**:
- Push the **consent artifact itself** as a `CONSENT`-type document (the API
  explicitly supports `type: CONSENT`, separate from `CLINICAL`)
- Push any patient-reported/patient-uploaded documents (e.g., outside records a
  patient manually uploads) as `CLINICAL` type
- Ask directly whether a query-mostly Individual-Access use case has a lighter
  reciprocity bar than a Treatment-POU integration — this is genuinely unclear
  from public docs and needs a direct answer

---

## 8. Phased build plan

**Phase 0 — Sandbox demo (no contract needed beyond dev access)**
- Use the public Postman collection + sandbox base URL
- Build against the 5 Gold-tier and 3 Bronze-tier synthetic patients first
  (richest, most predictable data) before the 190+ extended set
- Implement: Patients API registration → query → webhook → FHIR retrieval →
  normalize into your Patient 360 schema (scoped to the real 24-resource list)
- Prototype Snapshot output against the same sandbox patients to evaluate
  whether it can replace a custom summarization layer

**Phase 1 — Pilot / production access**
- Get a real pricing quote (not the ~$1/query public estimate) and BAA in place
- Confirm Individual Access POU approval explicitly with Particle given current
  Carequality oversight
- Build real identity verification + consent capture into onboarding
- Stand up webhook endpoint with signature verification
- Resolve the bi-directionality/Documents-push question (§7) before go-live

**Phase 2 — Continuous monitoring (optional, post-launch)**
- Add Signal subscriptions for enrolled patients so the agent can proactively
  know about new ADT events/encounters/discharge summaries between visits,
  rather than only pulling data once at onboarding

**Phase 3 — Coverage/claims gap-fill**
- Since Coverage is unreliable and Claim/EOB isn't available via Particle at
  all, scope a separate payer-side integration if insurance/claims data is
  actually required for your appointment-prep use case

---

## Sources (in addition to those cited in `particle_health_deep_research.md`)

- [Webhook Event Notifications](https://docs.particlehealth.com/docs/webhook-event-notifications)
- [Supported FHIR Resources](https://docs.particlehealth.com/docs/supported-fhir-resources)
- [Life of a Query](https://docs.particlehealth.com/docs/life-of-a-query)
- [C-CDA vs. FHIR](https://docs.particlehealth.com/docs/ccda-vs-fhir)
