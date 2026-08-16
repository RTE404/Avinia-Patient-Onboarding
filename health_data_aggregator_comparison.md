# Health Data Aggregator Comparison — Particle Health vs. Alternatives

Researched for the patient-onboarding module: patient submits demographics + goes
through IDV, we pull their full longitudinal US medical history (every provider
they've ever seen — the "tricky part") via an Individual Access purpose-of-use
query. Six companies researched; three are real candidates for this exact job,
three turned out to be solving a different problem.

---

## The real candidates

### Particle Health (baseline — see other docs in this folder for full detail)

- Founded 2018, $39.3M raised, established production usage, mature docs/sandbox/Postman collection
- Reaches TEFCA via CommonWell as its QHIN (not its own QHIN)
- Explicit Individual Access purpose-of-use support
- 2024 Epic/Carequality dispute over Treatment-POU misuse by downstream customers — **resolved** via corrective action plan + 6 months added oversight (now over a year past resolution)
- ~$1/query reported (unofficial)

### Health Gorilla

- Founded 2014, ~$80M raised, **operates its own QHIN** (one of the first 5 TEFCA QHINs, live Q1 2024) — structurally more direct than Particle's CommonWell pass-through
- Has a dedicated **"Patient Access" product** (launched Sept 2023) built specifically for IAS/Individual Access, with Consent modeled as a FHIR resource
- FHIR R4 + legacy STU3, broader resource list than Particle on paper (includes Consent, Goal, ServiceRequest)
- Sandbox exists but gated behind a CSM/sales contact, not self-serve
- **Major red flag:** Epic and several health systems filed a lawsuit against Health Gorilla in **January 2026** alleging ~300,000 patient records were accessed by *fraudulent shell "provider" entities* for non-treatment purposes — including sale of data to mass-tort law firms — with claims that junk/filler data was inserted to mask the activity. Health Gorilla denies systemic wrongdoing and has moved to dismiss; case is **ongoing, unresolved**, and Health Gorilla itself (not just a downstream customer) is the named defendant. This is a more severe version of the Particle/Epic dispute — it alleges fraud and data-integrity manipulation, not just a POU classification disagreement.

### Metriport

- Founded 2022 (YC S22), only a $2.4M seed disclosed — small, early-stage, no confirmed QHIN of its own
- Partially open-source (API server, FHIR converter, SDKs on GitHub, self-hostable) — but Carequality/CommonWell network access still requires Metriport's commercial credentials regardless of self-hosting
- **Purpose-built for exactly our use case**: explicit `purposeOfUse=ias` mode requiring a `proofedIdentityId` from **NIST IAL2** identity verification through an approved Credential Service Provider, plus an active **AAL2** MFA session per query — this is a much more rigorous, explicit, out-of-the-box match for "IDV-gated individual access" than what's documented for Particle or Health Gorilla
- Self-serve sandbox, modern developer experience, transparent-ish GitHub presence
- Real risk: small team, thin funding, unproven at scale, sparse independent reviews, some docs gaps (exact FHIR resource list, consent audit trail)

---

## Ruled out for this specific use case

### Zus Health — no Individual Access support
Positions itself as a "shared health record" platform (curated longitudinal record + embedded UI components) rather than a raw aggregator API, built on direct Carequality/CommonWell connections. **Documented purpose-of-use model is TPO only**, gated by `Patient.active = true` representing an active *treatment relationship* — no primary-source evidence of an Individual Access category. This is a hard blocker for a patient-self-service product unless a non-public custom arrangement exists (worth one sales call to confirm, but don't plan around it).

### 1upHealth — wrong architecture entirely
Confirmed **payer/claims-focused**, not a Carequality/CommonWell provider-network aggregator. Its clinical-data product works via pre-established point-to-point integrations with specific EHRs for patient rosters an organization already has a relationship with — not "find every provider a stranger-to-us patient has ever seen." Its Patient Access API is real and CMS-compliant, but scoped to claims/EOB/coverage from a payer the patient is already a member of. **Worth revisiting later as a claims/EOB gap-filler** (recall: Particle doesn't reliably return Coverage/Claim data) — not a Particle substitute.

### Redox — integration engine, not a network aggregator
Fundamentally point-to-point plumbing to specific, known EHR instances (100+ EHRs, very mature). Does have a Carequality/CommonWell/TEFCA "onramp," but Redox's own docs state it supports **Treatment purpose of use only** — for any other purpose of use, "the likelihood you will get meaningful value is near zero, because you will not get responses to your queries." No evidence of IAS support. This is architecturally the opposite of what we need — Redox is worth revisiting only if a future feature needs a specific, known, pre-negotiated EHR connection rather than open-ended discovery.

### CareEvolution — different model, thin evidence for this use case
Uses patient-mediated SMART-on-FHIR direct connections rather than Carequality/CommonWell network queries; no confirmed Carequality/CommonWell/TEFCA participation found. Has genuinely strong patient-matching tech (privacy-preserving record linkage, claimed 150M+ lives) and a CMS Blue Button-approved consumer product (myFHR) for Medicare claims specifically. Essentially absent from industry commentary/comparisons of this space. Not enough evidence to trust as a primary aggregator; its identity-matching tech might be worth a look later if patient matching becomes a real pain point.

---

## Bottom line

For "patient submits demographics → IDV → pull full US-wide longitudinal record
under Individual Access," there are really only **three legitimate options**:
Particle Health, Health Gorilla, and Metriport. The other three solve adjacent but
different problems (curated point-of-care record, payer/claims, or known-EHR
integration).

**My recommendation: stay on Particle Health as primary, and run a parallel
sandbox evaluation of Metriport — avoid Health Gorilla for now despite its
technically stronger QHIN position, because of the active, unresolved,
fraud-adjacent lawsuit.**

Reasoning:
- Particle already has a resolved dispute behind it (over a year of clean
  operation since the corrective action plan), proven production scale, and we
  already have deep integration knowledge built up on it — lowest switching
  friction, lowest current legal-contagion risk.
- Health Gorilla's own-QHIN position and dedicated Patient Access product are
  genuinely attractive on paper, but building a core dependency on a company
  currently defending fraud allegations *in the exact purpose-of-use category we'd
  be using* is a bad time to commit — this is worth revisiting once the
  litigation resolves, not now.
- Metriport's IAL2/AAL2-gated IAS model is arguably the most rigorous, explicit
  match for the architecture we're designing (identity verification feeding
  directly into the query authorization), it's free to sandbox-test, and its
  main weakness — company maturity — matters much less for a demo/prototype
  phase than it would for a production dependency. Worth building the same demo
  flow against both Particle and Metriport sandboxes and comparing real match
  quality/data richness before deciding which one goes to production.

---

## Sources

- [Health Gorilla QHIN page](https://www.healthgorilla.com/home/company/qhin) · [Patient Access launch](https://www.globenewswire.com/news-release/2023/09/20/2746456/0/en/Health-Gorilla-launches-Patient-Access-Enabling-Access-to-Health-Data-from-Health-Information-Networks-Through-Consumer-Queries.html) · [MedCityNews on Epic/Health Gorilla lawsuit](https://medcitynews.com/2026/01/epic-health-gorilla-lawsuit-interoperability-data/) · [FierceHealthcare follow-up](https://www.fiercehealthcare.com/health-tech/health-gorilla-urges-court-toss-lawsuit-filed-epic-health-systems)
- [Zus Health FHIR REST API Capabilities](https://docs.zushealth.com/docs/fhir-rest-api-capabilities) · [Accessing the ZAP](https://docs.zushealth.com/docs/accessing-the-zap) · [Builder Terms of Service](https://zushealth.com/builder-terms-of-service/)
- [Metriport IAS getting-started docs](https://metriport.mintlify.app/medical-api/getting-started/ias) · [Metriport quickstart](https://docs.metriport.com/medical-api/getting-started/quickstart) · [GitHub](https://github.com/metriport/metriport)
- [1upHealth Patient Access API docs](https://docs.1up.health/docs/patient-access/dev-implementation) · [1up Population Connect](https://1up.health/products/1up-population-connect/)
- [Redox TEFCA/CommonWell onramp docs](https://docs.redoxengine.com/how-to-use-redox/interact-with-clinical-networks/onramp-to-tefca-commonwell/set-up-your-onramp-to-tefca-commonwell/) · [Redox company page](https://redoxengine.com/company/)
- [CareEvolution integrations page](https://integrations.careevolution.com/) · [CareEvolution Identity/Orchestrate](https://careevolution.com/orchestrate/identity/)
