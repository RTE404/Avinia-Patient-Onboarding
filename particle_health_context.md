# Particle Health --- Healthcare Data Aggregation Context

## Purpose

This document captures the relevant context from the conversation about
**Particle Health**, US healthcare interoperability, FHIR, HIEs, QHINs,
EHRs, patient identity, and the potential use of Particle for a
patient-facing healthcare/doctor appointment agent.

------------------------------------------------------------------------

## 1. Core Product Idea

The user is exploring a US healthcare application, particularly a
**doctor appointment / healthcare AI agent**, that could aggregate a
patient's longitudinal healthcare history and use it to assist with
appointments.

The desired outcome is effectively a **Patient 360**:

-   Past encounters
-   Primary-care providers
-   Specialists
-   Hospitals and clinics
-   Diagnoses/conditions
-   Procedures
-   Lab results
-   Diagnostic reports
-   Medications and medication fills
-   Allergies
-   Immunizations
-   Vital signs
-   Clinical documents/notes where available
-   Insurance/coverage information
-   Family/social history where available
-   Care plans
-   Provider and organization information
-   Other available longitudinal clinical information

The user wants to avoid requiring patients to manually upload large
numbers of medical documents if the information can be retrieved
electronically.

------------------------------------------------------------------------

## 2. Important US Healthcare Interoperability Layers

The conversation established the following simplified mental model:

### EHRs --- where much of the actual clinical data lives

Examples:

-   Epic
-   Oracle Health / Cerner
-   Other EHR systems

A hospital or provider organization using Epic, for example, maintains
its own patient records in its Epic environment.

### HIE

A **Health Information Exchange (HIE)** facilitates exchange of health
information between participating healthcare organizations.

It is not necessarily a universal database containing every patient's
records.

### Carequality

Carequality is primarily an **interoperability framework/rules layer**,
not a central database.

It provides governance, technical/legal frameworks, and rules that allow
participating healthcare systems and networks to exchange health
information.

### CommonWell

CommonWell is an interoperability network/service infrastructure. It
supports capabilities such as patient identity, record location, and
exchange among participating organizations.

It is not the universal source-of-truth database for all US patient
records.

### TEFCA

**TEFCA = Trusted Exchange Framework and Common Agreement.**

It is the national framework for health information exchange and creates
a "network of networks."

### QHIN

**QHIN = Qualified Health Information Network.**

QHINs participate in TEFCA and provide large-scale exchange/network
connectivity.

A QHIN is primarily network/exchange infrastructure, not a giant
national database containing all patient records.

### Particle Health

Particle sits above/alongside these exchange mechanisms as a
**health-data aggregation/access layer**.

Its value is that a developer does not need to individually integrate
with thousands of healthcare organizations and all of their different
interoperability mechanisms.

------------------------------------------------------------------------

## 3. Simplified Architecture

The conceptual architecture discussed was:

``` text
                         YOUR APP
                            |
                            v
                     PARTICLE API
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
        Carequality    CommonWell    eHealth Exchange
             |              |              |
             +--------------+--------------+
                            |
                    Participating
                 healthcare organizations
                            |
              +-------------+-------------+
              |                           |
              v                           v
            Epic                   Oracle Health/Cerner
              |                           |
              v                           v
       Actual patient records      Actual patient records
```

Particle's role is to handle the complexity of locating and retrieving
records from its connected networks.

------------------------------------------------------------------------

## 4. What Particle Basically Does

Particle is not a giant database containing every American's medical
records.

Its core function is approximately:

1.  Accept patient demographic information.
2.  Create/identify a Particle patient.
3.  Perform patient matching / identity resolution.
4.  Use its Record Locator / connected networks to determine where
    records may exist.
5.  Query relevant network partners/endpoints.
6.  Retrieve available records.
7.  Normalize/expose the resulting information through APIs.
8.  Allow applications to consume the information as FHIR, C-CDA, or
    structured/flat data depending on the API/access.

Conceptually:

``` text
Patient demographics
        |
        v
Particle
        |
        v
Patient matching
        |
        v
Record locator
        |
        v
Connected networks
        |
        v
Matching providers / facilities
        |
        v
Available patient records
        |
        v
FHIR / C-CDA / structured data
```

------------------------------------------------------------------------

## 5. Patient Information Needed by Particle

The current Particle V2 Patient Registration API documentation was
checked during the conversation.

### Required fields for patient registration

The documented required demographic fields are:

-   First name
-   Last name
-   Date of birth
-   Gender
-   City
-   State
-   ZIP code

### Optional fields that can improve matching / record discovery

-   Street address
-   Phone number
-   Email
-   SSN
-   Additional identifiers/location information where supported

Particle's documentation describes patient matching/record validation
using available demographics such as:

-   Name
-   DOB
-   Gender
-   City
-   State
-   ZIP
-   Telephone
-   Email
-   SSN

The practical recommendation for a patient-facing onboarding flow is
therefore to collect:

``` text
First name
Last name
Date of birth
Gender

Street address
City
State
ZIP

Phone
Email

SSN (only if justified and appropriate)
```

However, the user does **not** need to provide a FHIR ID.

Particle creates its own patient identifier after registration.

------------------------------------------------------------------------

## 6. Documents the Patient Needs to Provide

The user asked what ordinary US documents could contain the demographic
information.

There is no single standard document containing all of the useful
Particle matching fields.

### Driver's license / state ID

Can generally provide:

-   First name
-   Last name
-   DOB
-   Sex/gender
-   Address
-   City/state
-   ZIP
-   State ID/license number

### Phone/email

Usually collected directly from the patient.

### SSN

Not normally present on an ID card. If collected, it should be a
separate field and only when justified by the application's
identity/matching and legal requirements.

### Insurance card

Not required for the basic Particle patient search.

It mainly provides:

-   Payer
-   Member ID
-   Group/policy information
-   Pharmacy benefit information in some cases

An insurance card is primarily an identifier/routing mechanism, not a
patient's clinical record.

------------------------------------------------------------------------

## 7. Patient Authorization Is Separate from Demographic Matching

A crucial distinction:

``` text
Demographic information
        =
"Who is this patient?"
```

versus

``` text
Authorization / consent / purpose of use
        =
"Are we allowed to retrieve this patient's information?"
```

Collecting demographics does not automatically authorize an application
to retrieve all of a person's healthcare information.

The application's legal/access model, purpose of use, patient
authorization, identity verification, and Particle's network/access
policies all matter.

For a patient-facing application, the intended flow should be designed
around an appropriate patient authorization/Individual Access model
where supported.

------------------------------------------------------------------------

## 8. Particle Patient ID

The patient does not need a universal US healthcare ID or FHIR ID.

The US does **not** have a universal nationwide patient healthcare
identifier assigned to every person.

FHIR resource IDs are generally scoped to the relevant FHIR
server/system.

For example, the same real-world person could appear as:

``` text
Hospital A:
Patient/12345

Hospital B:
Patient/987654

Payer:
Patient/ABC789
```

These can all represent the same person.

Particle creates its own patient identifier, such as a
`particle_patient_id`, after patient registration.

This allows Particle to manage its own patient matching and record
retrieval workflow.

------------------------------------------------------------------------

## 9. Does Every US Patient Have a Unique Healthcare ID?

No.

The US has many local/system-specific identifiers:

-   Hospital MRN
-   Payer member ID
-   Pharmacy identifiers
-   Other organization-specific identifiers
-   FHIR resource IDs

But there is no universal national patient identifier equivalent to a
nationwide healthcare ID.

The US does have the **NPI (National Provider Identifier)** for
healthcare providers, but NPI identifies providers/organizations, not
patients.

------------------------------------------------------------------------

## 10. What FHIR Is

**FHIR = Fast Healthcare Interoperability Resources.**

FHIR is an HL7 standard for representing and exchanging healthcare data.

FHIR uses modular objects called **Resources**.

FHIR is not itself a database and not a single patient record.

------------------------------------------------------------------------

## 11. Important FHIR Resources for Patient 360

FHIR contains many resource types.

The most relevant for the user's application are:

  Resource                   Typical information
  -------------------------- -------------------------------------------
  Patient                    Demographics and identifiers
  Encounter                  Doctor visits, hospital visits, ER visits
  Condition                  Diagnoses/problems
  Observation                Vitals, lab values, measurements
  DiagnosticReport           Lab/imaging reports
  Procedure                  Surgeries/procedures
  MedicationRequest          Prescriptions
  MedicationDispense         Medication dispensed
  MedicationAdministration   Medication administered
  AllergyIntolerance         Allergies
  Immunization               Vaccinations
  CarePlan                   Care plans
  CareTeam                   Providers involved in care
  Practitioner               Doctors/providers
  Organization               Hospitals, clinics, labs
  Location                   Healthcare locations
  DocumentReference          Clinical documents
  ImagingStudy               Imaging studies
  Coverage                   Insurance coverage
  Claim                      Insurance claims
  ExplanationOfBenefit       Processed insurance claims/EOBs
  Appointment                Appointments
  Consent                    Consent information
  Provenance                 Data source/origin

A Patient 360 would likely focus heavily on:

``` text
Patient
Encounter
Condition
Observation
DiagnosticReport
Procedure
MedicationRequest
MedicationDispense
AllergyIntolerance
Immunization
Practitioner
Organization
DocumentReference
Coverage
ExplanationOfBenefit
```

------------------------------------------------------------------------

## 12. Can Particle Return the Whole FHIR Record?

Yes, with an important qualification.

Particle's current documentation describes a FHIR retrieval endpoint
that can return a **FHIR R4 Bundle** for a patient using an
`$everything`-style operation.

Conceptually:

``` text
Register patient
       |
       v
Particle Patient ID
       |
       v
Run query
       |
       v
Wait for query completion
       |
       v
Retrieve patient FHIR data
       |
       v
FHIR R4 Bundle
```

This means the application does not necessarily need to individually
request:

``` text
Encounter
Condition
Observation
Procedure
Medication
...
```

one by one to reconstruct the entire available record.

Particle can return a patient-level FHIR bundle containing the resources
it has successfully retrieved.

Particle also documents a Deltas `$everything` workflow. Without
`_since`, the documented behavior can provide the full history available
in Particle's FHIR store; with `_since`, it can retrieve newly
discovered/changed data.

------------------------------------------------------------------------

## 13. What Data Can Particle Potentially Return?

The conversation established that Particle can potentially provide a
broad longitudinal record, including:

-   Past encounters/visits
-   Providers/practitioners
-   Hospitals/clinics
-   Diagnoses/conditions
-   Procedures
-   Lab results
-   Diagnostic reports
-   Medications
-   Medication fills
-   Allergies
-   Immunizations
-   Vital signs
-   Clinical documents/notes where available
-   Insurance/coverage information
-   Family history where available
-   Social history where available
-   Care plans
-   Locations
-   Organizations
-   Provenance/source information

Particle supports FHIR R4, C-CDA, and structured/flat data through
different retrieval interfaces.

------------------------------------------------------------------------

## 14. Important Limitation: "All Data" Does Not Mean Literally Everything

The correct statement is:

> Particle can retrieve the available records it can locate through its
> connected networks and authorized access pathways.

It is **not** guaranteed to retrieve every healthcare record that has
ever existed for a patient.

Potential gaps include:

-   Providers that are not connected
-   Organizations that do not participate in the relevant network
-   Data that the source does not make available
-   Records that are inaccessible due to authorization/policy
-   Data in non-structured formats
-   Documents that may be returned as PDFs/images rather than clean FHIR
-   Network-specific limitations
-   Patient matching failures

Therefore:

``` text
Particle result
=
Available + discoverable + authorized + successfully retrieved data
```

not:

``` text
Particle result
=
Every healthcare record ever generated in the US
```

------------------------------------------------------------------------

## 15. How Epic and Oracle Health/Cerner Fit In

Epic and Oracle Health/Cerner are **EHR vendors/systems**.

They are closer to the actual source of clinical data.

### Epic

Hospitals/providers using Epic maintain patient records in Epic
environments.

Epic participates in interoperability mechanisms such as Carequality and
has its own interoperability ecosystem, including Epic Care Everywhere
and Epic Nexus.

### Oracle Health/Cerner

Oracle Health acquired Cerner.

Healthcare organizations using Oracle Health/Cerner maintain records in
those EHR environments.

Oracle Health/Cerner participates in interoperability networks such as
CommonWell and provides FHIR/interoperability capabilities.

### Particle

Particle does not replace Epic or Oracle Health.

Instead, Particle connects to interoperability networks and uses them to
reach participating organizations whose underlying EHRs may be Epic,
Oracle Health/Cerner, and many others.

------------------------------------------------------------------------

## 16. Carequality vs CommonWell vs EHR

A useful distinction:

  --------------------------------------------------------------------------
  Component               What it is              Is it the source-of-truth
                                                  patient database?
  ----------------------- ----------------------- --------------------------
  Epic                    EHR                     Yes, for records
                                                  maintained by the Epic
                                                  organization

  Oracle Health/Cerner    EHR                     Yes, for records
                                                  maintained by that
                                                  organization

  Hospital/clinic         Healthcare organization Yes, for records it
                                                  maintains

  HIE                     Health-information      Exchange/infrastructure;
                          exchange                not a universal national
                                                  record

  Carequality             Interoperability        No
                          framework               

  CommonWell              Interoperability        No universal national
                          network/services        record

  TEFCA                   National                No
                          interoperability        
                          framework               

  QHIN                    Qualified Health        No universal national
                          Information Network     record

  Particle                Data aggregation/access Not the universal
                          layer                   source-of-truth
  --------------------------------------------------------------------------

The most important mental model is:

> **Healthcare organizations/EHRs hold much of the underlying data.
> Exchange networks make it possible to locate/exchange that data.
> Particle aggregates that complexity for developers.**

------------------------------------------------------------------------

## 17. Particle and QHIN/HIE Relationship

Particle connects to multiple healthcare interoperability networks,
including:

-   Carequality
-   CommonWell
-   eHealth Exchange
-   Certain state HIEs
-   Other supported sources/integrations

Particle's role is to query these connected networks and retrieve
records from participating healthcare organizations.

Particle therefore acts as a practical aggregation layer:

``` text
Your application
      |
      v
Particle
      |
      +-- Carequality
      |
      +-- CommonWell
      |
      +-- eHealth Exchange
      |
      +-- State HIEs
      |
      +-- Other supported networks/data sources
      |
      v
Participating healthcare organizations
      |
      v
Epic / Oracle / other EHR systems
      |
      v
Patient records
```

------------------------------------------------------------------------

## 18. Why Particle Is Useful

Without an aggregator, a startup would have to deal with many different:

-   EHR APIs
-   HIEs
-   interoperability networks
-   authentication models
-   patient matching systems
-   FHIR implementations
-   C-CDA documents
-   network-specific query protocols
-   provider organizations

Particle abstracts much of that complexity.

The developer can instead work primarily with Particle's API.

------------------------------------------------------------------------

## 19. Demo / Sandbox

The user wants to create a demo.

Particle provides a **developer/test sandbox** with synthetic patients
and mock medical records.

The sandbox is intended for prototyping/testing and does not use real
PHI/PII.

Particle's documentation has described a sandbox query limit of **500
queries per organization per day**.

Production access is separate and requires appropriate
verification/customer onboarding and credentials.

Therefore, for a demo:

``` text
Particle Sandbox
      |
      v
Synthetic patient
      |
      v
Query
      |
      v
FHIR R4 / mock records
      |
      v
Patient 360 demo
```

The sandbox is the appropriate starting point for demonstrating the
application's architecture without needing real patient data.

------------------------------------------------------------------------

## 20. Proposed Patient Onboarding Flow

A practical concept discussed:

``` text
Create account
      |
      v
Collect patient demographics
      |
      +-- First name
      +-- Last name
      +-- DOB
      +-- Gender
      +-- Address
      +-- City
      +-- State
      +-- ZIP
      +-- Phone
      +-- Email
      +-- Optional SSN
      |
      v
Identity verification
      |
      v
Patient authorization/consent
      |
      v
Particle patient registration
      |
      v
Particle patient ID
      |
      v
Query connected networks
      |
      v
Retrieve available records
      |
      v
FHIR R4 Bundle
      |
      v
Normalize/store in Patient 360
      |
      v
Healthcare / doctor AI agent
```

A driver's license/state ID may be useful for identity verification and
can contain many of the core demographics, but it is not itself a
substitute for patient authorization.

An insurance card is not required for the basic Particle demographic
patient search.

------------------------------------------------------------------------

## 21. Key Product Insight

The user initially considered:

> Insurance card → patient data

The conversation clarified that this is not the best architecture.

A better architecture is:

``` text
Patient identity + authorization
             |
             v
        Data aggregator
             |
       +-----+-----+
       |           |
    Clinical     Payer
    networks     APIs
       |           |
       +-----+-----+
             |
             v
       Patient 360
             |
             v
      Doctor AI Agent
```

Particle is potentially the primary source for broad
**clinical/network-connected history**, while payer-specific
integrations can supplement claims, coverage, and insurance information.

------------------------------------------------------------------------

## 22. Questions Still Worth Verifying Before Building

Before building a real production application, the following should be
confirmed directly with Particle:

1.  Exact commercial pricing for production API usage.
2.  Whether the intended application qualifies for the desired
    Individual Access / patient-facing use case.
3.  Exact patient consent/authorization requirements.
4.  Identity verification requirements.
5.  Exact networks and data sources available to the intended customer.
6.  Exact FHIR resources available for a patient-level `$everything`.
7.  Which records are returned as structured FHIR vs C-CDA vs
    documents/PDFs.
8.  Whether payer/claims data is included in the selected Particle
    product/access tier.
9.  Rate limits and query limits.
10. Data retention/storage requirements.
11. HIPAA/business-associate requirements for the startup.
12. How incremental/delta updates work after the initial patient
    retrieval.

------------------------------------------------------------------------

## 23. Shortest Mental Model

If everything above becomes confusing again, remember:

``` text
EPIC / ORACLE / OTHER EHRs
        ↓
actual healthcare records

CAREQUALITY / COMMONWELL / OTHER NETWORKS
        ↓
move/find/exchange those records

TEFCA / QHINs
        ↓
large-scale national exchange framework/network layer

PARTICLE
        ↓
aggregates the complexity and gives your app APIs

YOUR APP
        ↓
Patient 360 / AI healthcare agent
```

**Particle's value is not that it owns all US patient data. Its value is
that it provides a developer-facing aggregation layer capable of finding
and retrieving available patient records across multiple connected
healthcare networks.**
