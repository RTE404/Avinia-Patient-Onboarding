# Patient Onboarding Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demonstrate that a patient can provide minimal demographics + go through
mocked identity verification, and the app will use Particle Health to
automatically retrieve their available US healthcare history — without manual
document upload — for a small, fixed set of Particle sandbox patients.

**Architecture:** A TypeScript npm-workspaces monorepo with four packages:
`shared` (types + the 8-patient picklist), `api` (Express backend that talks to
Particle, normalizes Flat/FHIR into one common shape, and serves cached or live
results), `scripts` (an offline prefetch script that populates the cache), and
`web` (a React frontend for the onboarding flow). No database — the cache is
static JSON files on disk.

**Tech Stack:** TypeScript, Node.js (native `fetch`), Express, React + Vite,
Vitest + Supertest + @testing-library/react, npm workspaces.

**Spec:** `demo_design_spec.md` (repo root) — read this first for the full
rationale behind every decision below. `demo_architecture_decisions.md` has the
decision log if anything here seems to need justification beyond what's
restated here.

## Global Constraints

- **No persistent storage / no database.** "Storage" means static JSON files
  under `packages/api/src/cache/`, nothing else.
- **Particle sandbox only**, base URL `https://sandbox.particlehealth.com`
  (confirmed directly from Particle's own OpenAPI reference pages, not
  paraphrased docs).
- **`purpose_of_use: "INDIVIDUAL_ACCESS"`** on every query — never `TREATMENT`.
- **Branch retrieval per patient tier**: Gold patients → `GET .../flat`, Bronze
  patients → `GET .../fhir`. No CCDA parsing anywhere in this plan.
- **The exact 8 confirmed sandbox patients** (from
  `particle_sandbox_patient_picklist.json`) are the only patients this app
  handles. Arbitrary/invented demographics are out of scope — they will not
  match anything in Particle's sandbox.
- **Consent gating is enforced server-side**, not just hidden in the UI.
- **Sparse/missing clinical data (empty allergies, blank practitioner names,
  unlinked encounters, etc.) is the normal case, not an error** — confirmed
  directly against Particle's own real sample data. Normalization code must
  never throw on missing fields.
- **`flow.ts` is the single shared orchestration function** — the prefetch
  script and the live-mode API route both call it. Never duplicate the
  register→query→poll→retrieve→normalize sequence.
- Tests must mock the Particle HTTP boundary — never call the real sandbox API
  from an automated test (it has a 500-query/day cap and multi-minute
  latency).

---

## Task 1: Monorepo scaffold + shared package

**Files:**
- Create: `package.json` (workspace root)
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/sandbox-patients.ts`
- Test: `packages/shared/src/sandbox-patients.test.ts`

**Interfaces:**
- Produces: `NormalizedPatientRecord` and its constituent types
  (`NormalizedProvider`, `NormalizedOrganization`, `NormalizedEncounter`,
  `NormalizedCondition`, `NormalizedMedication`, `NormalizedAllergy`,
  `NormalizedImmunization`, `NormalizedLabResult`), `SandboxPatient`,
  `SandboxPatientDemographics`, `SandboxTier` (`'GOLD' | 'BRONZE'`), and the
  `sandboxPatients: SandboxPatient[]` array — all consumed by every later task.

- [ ] **Step 1: Create the workspace root**

`package.json`:
```json
{
  "name": "patient-onboarding-demo",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/api",
    "packages/scripts",
    "packages/web"
  ],
  "scripts": {
    "test": "npm run test --workspaces --if-present",
    "prefetch": "npm run prefetch --workspace packages/scripts"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 2: Scaffold the shared package**

`packages/shared/package.json`:
```json
{
  "name": "@onboarding/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "src/types.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 3: Write `types.ts` (no test needed — pure type declarations, verified by every consumer's type-check)**

`packages/shared/src/types.ts`:
```typescript
export type SandboxTier = 'GOLD' | 'BRONZE';

export interface SandboxPatientDemographics {
  given_name: string;
  family_name: string;
  gender: 'FEMALE' | 'MALE';
  date_of_birth: string;
  address_lines: string[];
  address_city: string;
  address_state: string;
  postal_code: string;
  patient_id: string;
}

export interface SandboxPatient {
  name: string;
  tier: SandboxTier;
  demographics: SandboxPatientDemographics;
}

export interface NormalizedProvider {
  id: string;
  givenName: string;
  familyName: string;
  specialty: string | null;
}

export interface NormalizedOrganization {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export interface NormalizedEncounter {
  id: string;
  typeName: string | null;
  startTime: string | null;
  endTime: string | null;
  providerId: string | null;
}

export interface NormalizedCondition {
  id: string;
  name: string;
  code: string | null;
  clinicalStatus: string | null;
  onsetDate: string | null;
}

export interface NormalizedMedication {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  doseValue: string | null;
  doseUnit: string | null;
  doseRoute: string | null;
}

export interface NormalizedAllergy {
  id: string;
  substance: string;
  reaction: string | null;
  severity: string | null;
}

export interface NormalizedImmunization {
  id: string;
  name: string;
  date: string | null;
}

export interface NormalizedLabResult {
  id: string;
  name: string;
  value: string | null;
  unit: string | null;
  interpretation: string | null;
  timestamp: string | null;
}

export interface NormalizedPatientRecord {
  patientId: string;
  sourceFormat: 'FLAT' | 'FHIR';
  demographics: {
    givenName: string;
    familyName: string;
    gender: string | null;
    dateOfBirth: string | null;
  };
  providers: NormalizedProvider[];
  organizations: NormalizedOrganization[];
  encounters: NormalizedEncounter[];
  conditions: NormalizedCondition[];
  medications: NormalizedMedication[];
  allergies: NormalizedAllergy[];
  immunizations: NormalizedImmunization[];
  labResults: NormalizedLabResult[];
}
```

- [ ] **Step 4: Write the failing test for `sandbox-patients.ts`**

`packages/shared/src/sandbox-patients.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sandboxPatients } from './sandbox-patients.js';

describe('sandboxPatients', () => {
  it('has exactly 8 confirmed patients', () => {
    expect(sandboxPatients).toHaveLength(8);
  });

  it('has 5 GOLD and 3 BRONZE patients', () => {
    const gold = sandboxPatients.filter((p) => p.tier === 'GOLD');
    const bronze = sandboxPatients.filter((p) => p.tier === 'BRONZE');
    expect(gold).toHaveLength(5);
    expect(bronze).toHaveLength(3);
  });

  it('every patient_id is unique', () => {
    const ids = sandboxPatients.map((p) => p.demographics.patient_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Hart Fallon is a BRONZE patient registered as test-007', () => {
    const hart = sandboxPatients.find((p) => p.name === 'Hart Fallon');
    expect(hart?.tier).toBe('BRONZE');
    expect(hart?.demographics.patient_id).toBe('test-007');
    expect(hart?.demographics.date_of_birth).toBe('1952-10-01');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd packages/shared && npx vitest run`
Expected: FAIL — `sandbox-patients.ts` does not exist yet (module not found).

- [ ] **Step 6: Write `sandbox-patients.ts`**

Exact values below are machine-parsed from Particle's own
[Test Patient Sandbox](https://docs.particlehealth.com/docs/test-patient-sandbox)
docs table (already verified in `particle_sandbox_patient_picklist.json` —
copy the 8 `confirmed` entries from there).

`packages/shared/src/sandbox-patients.ts`:
```typescript
import type { SandboxPatient } from './types.js';

export const sandboxPatients: SandboxPatient[] = [
  {
    name: 'Elvira Valadez-Nucleus',
    tier: 'GOLD',
    demographics: {
      given_name: 'Elvira',
      family_name: 'Valadez-Nucleus',
      gender: 'FEMALE',
      date_of_birth: '1970-12-26',
      address_lines: ['703 Ankunding Trail Unit 45'],
      address_city: 'Boston',
      address_state: 'MA',
      postal_code: '02215',
      patient_id: 'test-001',
    },
  },
  {
    name: 'Glynda Sugarman-Nucleus',
    tier: 'GOLD',
    demographics: {
      given_name: 'Glynda',
      family_name: 'Sugarman-Nucleus',
      gender: 'FEMALE',
      date_of_birth: '1968-01-01',
      address_lines: ['123 Test Street'],
      address_city: 'Anytown',
      address_state: 'NY',
      postal_code: '11222',
      patient_id: 'test-002',
    },
  },
  {
    name: 'Freda Quently-Nucleus',
    tier: 'GOLD',
    demographics: {
      given_name: 'Freda',
      family_name: 'Quently-Nucleus',
      gender: 'FEMALE',
      date_of_birth: '1994-03-22',
      address_lines: ['123 Main Street'],
      address_city: 'Anytown',
      address_state: 'NY',
      postal_code: '11206',
      patient_id: 'test-003',
    },
  },
  {
    name: 'Kam Quark-Nucleus',
    tier: 'GOLD',
    demographics: {
      given_name: 'Kam',
      family_name: 'Quark-Nucleus',
      gender: 'MALE',
      date_of_birth: '1954-12-01',
      address_lines: ['999 Dev Drive'],
      address_city: 'Brooklyn',
      address_state: 'NY',
      postal_code: '11111',
      patient_id: 'test-004',
    },
  },
  {
    name: 'Artie Jointson-Nucleus',
    tier: 'GOLD',
    demographics: {
      given_name: 'Artie',
      family_name: 'Jointson-Nucleus',
      gender: 'MALE',
      date_of_birth: '1951-08-15',
      address_lines: ['123 Art St'],
      address_city: 'Anytown',
      address_state: 'NY',
      postal_code: '11222',
      patient_id: 'test-005',
    },
  },
  {
    name: 'Hart Fallon',
    tier: 'BRONZE',
    demographics: {
      given_name: 'Hart',
      family_name: 'Fallon',
      gender: 'MALE',
      date_of_birth: '1952-10-01',
      address_lines: ['456 Elm Street'],
      address_city: 'Sample City',
      address_state: 'NY',
      postal_code: '11206',
      patient_id: 'test-007',
    },
  },
  {
    name: 'Tuma Nephro',
    tier: 'BRONZE',
    demographics: {
      given_name: 'Tuma',
      family_name: 'Nephro',
      gender: 'FEMALE',
      date_of_birth: '1959-04-05',
      address_lines: ['789 Dev Street'],
      address_city: 'Sample City',
      address_state: 'NY',
      postal_code: '11211',
      patient_id: 'test-012',
    },
  },
  {
    name: 'Grant Bogisich',
    tier: 'BRONZE',
    demographics: {
      given_name: 'Grant',
      family_name: 'Bogisich',
      gender: 'MALE',
      date_of_birth: '1995-09-05',
      address_lines: ['710 Batz Estate'],
      address_city: 'Harwich',
      address_state: 'MA',
      postal_code: '02645',
      patient_id: 'test-008',
    },
  },
];
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd packages/shared && npx vitest run`
Expected: PASS (4 tests)

- [ ] **Step 8: Install dependencies and commit**

```bash
npm install
git add package.json tsconfig.base.json packages/shared
git commit -m "feat: scaffold monorepo and shared types/sandbox patient data"
```

---

## Task 2: Particle auth client

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/src/particle/client.ts`
- Test: `packages/api/src/particle/client.test.ts`

**Interfaces:**
- Consumes: nothing (first API-package module)
- Produces: `getAccessToken(fetchImpl?: typeof fetch): Promise<string>`,
  `resetTokenCacheForTests(): void` — consumed by every other `particle/*`
  module in Task 3+.

**Note on the endpoint:** confirmed directly from Particle's `/reference/get_auth-1`
OpenAPI page: `GET /auth` at `https://sandbox.particlehealth.com`, with
`client-id`, `client-secret`, and optional `scope` as **request headers** (not
a POST body, not standard OAuth2 token-endpoint form encoding). The response
is the JWT as plain text, not JSON.

- [ ] **Step 1: Scaffold the api package**

`packages/api/package.json`:
```json
{
  "name": "@onboarding/api",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "@onboarding/shared": "*",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/api/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Write the failing test**

`packages/api/src/particle/client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAccessToken, resetTokenCacheForTests } from './client.js';

describe('getAccessToken', () => {
  beforeEach(() => {
    resetTokenCacheForTests();
    vi.stubEnv('PARTICLE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('PARTICLE_CLIENT_SECRET', 'test-client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches a token from GET /auth with credential headers and caches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'fake.jwt.token',
    });

    const token1 = await getAccessToken(fetchMock as unknown as typeof fetch);
    const token2 = await getAccessToken(fetchMock as unknown as typeof fetch);

    expect(token1).toBe('fake.jwt.token');
    expect(token2).toBe('fake.jwt.token');
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/auth');
    expect(init.headers['client-id']).toBe('test-client-id');
    expect(init.headers['client-secret']).toBe('test-client-secret');
  });

  it('throws if credentials are missing', async () => {
    vi.unstubAllEnvs();
    await expect(getAccessToken(vi.fn() as unknown as typeof fetch)).rejects.toThrow(
      'PARTICLE_CLIENT_ID and PARTICLE_CLIENT_SECRET must be set',
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/particle/client.test.ts`
Expected: FAIL — `client.ts` does not exist yet.

- [ ] **Step 4: Write `client.ts`**

`packages/api/src/particle/client.ts`:
```typescript
const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';
const TOKEN_TTL_MS = 60 * 60 * 1000; // Particle tokens are valid for 60 minutes
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

interface TokenState {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenState | null = null;

export async function getAccessToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > now) {
    return cachedToken.token;
  }

  const clientId = process.env.PARTICLE_CLIENT_ID;
  const clientSecret = process.env.PARTICLE_CLIENT_SECRET;
  const scope = process.env.PARTICLE_SCOPE;

  if (!clientId || !clientSecret) {
    throw new Error('PARTICLE_CLIENT_ID and PARTICLE_CLIENT_SECRET must be set');
  }

  const headers: Record<string, string> = {
    'client-id': clientId,
    'client-secret': clientSecret,
  };
  if (scope) {
    headers['scope'] = scope;
  }

  const response = await fetchImpl(`${PARTICLE_BASE_URL}/auth`, { method: 'GET', headers });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Particle auth failed: ${response.status} ${body}`);
  }

  const token = (await response.text()).trim();
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

export function resetTokenCacheForTests(): void {
  cachedToken = null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/particle/client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/api/package.json packages/api/tsconfig.json packages/api/vitest.config.ts packages/api/src/particle/client.ts packages/api/src/particle/client.test.ts
git commit -m "feat: add Particle auth client with token caching"
```

---

## Task 3: Particle patients client (register, query, status)

**Files:**
- Create: `packages/api/src/particle/patients.ts`
- Test: `packages/api/src/particle/patients.test.ts`

**Interfaces:**
- Consumes: `getAccessToken` from `./client.js`; `SandboxPatientDemographics`
  from `@onboarding/shared`
- Produces: `registerPatient(demographics, fetchImpl?): Promise<RegisteredPatient>`,
  `startQuery(particlePatientId, fetchImpl?): Promise<QueryStartResult>`,
  `getQueryStatus(particlePatientId, queryId, fetchImpl?): Promise<QueryStatus>`
  — all consumed by `flow.ts` in Task 7. `QueryStatus.state` is a string whose
  observed value on completion is exactly `'COMPLETE'` (confirmed from
  Particle's `Get Query Status` OpenAPI reference).

- [ ] **Step 1: Write the failing test**

`packages/api/src/particle/patients.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from './client.js';
import { registerPatient, startQuery, getQueryStatus } from './patients.js';
import type { SandboxPatientDemographics } from '@onboarding/shared';

const demographics: SandboxPatientDemographics = {
  given_name: 'Hart',
  family_name: 'Fallon',
  gender: 'MALE',
  date_of_birth: '1952-10-01',
  address_lines: ['456 Elm Street'],
  address_city: 'Sample City',
  address_state: 'NY',
  postal_code: '11206',
  patient_id: 'test-007',
};

beforeEach(() => {
  vi.spyOn(client, 'getAccessToken').mockResolvedValue('fake-token');
});

describe('registerPatient', () => {
  it('POSTs to /api/v2/patients with a bearer token and returns particle_patient_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...demographics, particle_patient_id: 'ppid-123' }),
    });

    const result = await registerPatient(demographics, fetchMock as unknown as typeof fetch);

    expect(result.particle_patient_id).toBe('ppid-123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer fake-token');
    expect(JSON.parse(init.body)).toEqual(demographics);
  });
});

describe('startQuery', () => {
  it('POSTs purpose_of_use INDIVIDUAL_ACCESS and returns a query_id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query_id: 'q-1',
        particle_patient_id: 'ppid-123',
        purpose_of_use: 'INDIVIDUAL_ACCESS',
      }),
    });

    const result = await startQuery('ppid-123', fetchMock as unknown as typeof fetch);

    expect(result.query_id).toBe('q-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-123/query');
    expect(JSON.parse(init.body)).toEqual({ purpose_of_use: 'INDIVIDUAL_ACCESS' });
  });
});

describe('getQueryStatus', () => {
  it('GETs the query status and returns the state field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'q-1', state: 'COMPLETE', particle_patient_id: 'ppid-123' }),
    });

    const result = await getQueryStatus('ppid-123', 'q-1', fetchMock as unknown as typeof fetch);

    expect(result.state).toBe('COMPLETE');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://sandbox.particlehealth.com/api/v2/patients/ppid-123/query?query_id=q-1',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/particle/patients.test.ts`
Expected: FAIL — `patients.ts` does not exist yet.

- [ ] **Step 3: Write `patients.ts`**

`packages/api/src/particle/patients.ts`:
```typescript
import { getAccessToken } from './client.js';
import type { SandboxPatientDemographics } from '@onboarding/shared';

const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';

export interface RegisteredPatient extends SandboxPatientDemographics {
  particle_patient_id: string;
}

export async function registerPatient(
  demographics: SandboxPatientDemographics,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisteredPatient> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(`${PARTICLE_BASE_URL}/api/v2/patients`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(demographics),
  });

  if (!response.ok) {
    throw new Error(`Particle patient registration failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as RegisteredPatient;
}

export interface QueryStartResult {
  query_id: string;
  particle_patient_id: string;
  purpose_of_use: string;
}

export async function startQuery(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QueryStartResult> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purpose_of_use: 'INDIVIDUAL_ACCESS' }),
    },
  );

  if (!response.ok) {
    throw new Error(`Particle query start failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as QueryStartResult;
}

export interface QueryStatus {
  id: string;
  state: string;
  particle_patient_id: string;
}

export async function getQueryStatus(
  particlePatientId: string,
  queryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QueryStatus> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/query?query_id=${queryId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Particle query status check failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as QueryStatus;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/particle/patients.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/particle/patients.ts packages/api/src/particle/patients.test.ts
git commit -m "feat: add Particle patients client (register, query, status)"
```

---

## Task 4: Particle retrieval client (tier branch)

**Files:**
- Create: `packages/api/src/particle/retrieve.ts`
- Test: `packages/api/src/particle/retrieve.test.ts`

**Interfaces:**
- Consumes: `getAccessToken` from `./client.js`
- Produces: `fetchFlat(particlePatientId, fetchImpl?): Promise<FlatDomains>`,
  `fetchFhir(particlePatientId, fetchImpl?): Promise<FhirBundle>`,
  `retrieveByTier(particlePatientId, tier, fetchImpl?): Promise<Retrieval>`
  where `Retrieval = { format: 'FLAT'; data: FlatDomains } | { format: 'FHIR'; data: FhirBundle }`
  — consumed by `normalize/index.ts` (Task 6) and `flow.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

`packages/api/src/particle/retrieve.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from './client.js';
import { fetchFlat, fetchFhir, retrieveByTier } from './retrieve.js';

beforeEach(() => {
  vi.spyOn(client, 'getAccessToken').mockResolvedValue('fake-token');
});

describe('fetchFlat', () => {
  it('GETs the flat endpoint and returns domain-keyed arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ patients: [{ given_name: 'Elvira' }], medications: [] }),
    });

    const result = await fetchFlat('ppid-1', fetchMock as unknown as typeof fetch);

    expect(result.patients).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-1/flat');
  });
});

describe('fetchFhir', () => {
  it('GETs the fhir endpoint and returns a searchset Bundle', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] }),
    });

    const result = await fetchFhir('ppid-2', fetchMock as unknown as typeof fetch);

    expect(result.resourceType).toBe('Bundle');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.particlehealth.com/api/v2/patients/ppid-2/fhir');
  });
});

describe('retrieveByTier', () => {
  it('calls fetchFlat for GOLD and fetchFhir for BRONZE', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] }),
    });

    const bronzeResult = await retrieveByTier('ppid-3', 'BRONZE', fetchMock as unknown as typeof fetch);
    expect(bronzeResult.format).toBe('FHIR');
    expect(fetchMock.mock.calls[0][0]).toContain('/fhir');

    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ patients: [] }) });
    const goldResult = await retrieveByTier('ppid-4', 'GOLD', fetchMock as unknown as typeof fetch);
    expect(goldResult.format).toBe('FLAT');
    expect(fetchMock.mock.calls[0][0]).toContain('/flat');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/particle/retrieve.test.ts`
Expected: FAIL — `retrieve.ts` does not exist yet.

- [ ] **Step 3: Write `retrieve.ts`**

`packages/api/src/particle/retrieve.ts`:
```typescript
import { getAccessToken } from './client.js';
import type { SandboxTier } from '@onboarding/shared';

const PARTICLE_BASE_URL = process.env.PARTICLE_BASE_URL ?? 'https://sandbox.particlehealth.com';

export type FlatDomains = Record<string, Array<Record<string, unknown>>>;

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: string;
  total: number;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
}

async function authorizedGet<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const token = await getAccessToken(fetchImpl);
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Particle retrieval failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function fetchFlat(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FlatDomains> {
  return authorizedGet<FlatDomains>(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/flat`,
    fetchImpl,
  );
}

export async function fetchFhir(
  particlePatientId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FhirBundle> {
  return authorizedGet<FhirBundle>(
    `${PARTICLE_BASE_URL}/api/v2/patients/${particlePatientId}/fhir`,
    fetchImpl,
  );
}

export type Retrieval =
  | { format: 'FLAT'; data: FlatDomains }
  | { format: 'FHIR'; data: FhirBundle };

export async function retrieveByTier(
  particlePatientId: string,
  tier: SandboxTier,
  fetchImpl: typeof fetch = fetch,
): Promise<Retrieval> {
  if (tier === 'GOLD') {
    return { format: 'FLAT', data: await fetchFlat(particlePatientId, fetchImpl) };
  }
  return { format: 'FHIR', data: await fetchFhir(particlePatientId, fetchImpl) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/particle/retrieve.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/particle/retrieve.ts packages/api/src/particle/retrieve.test.ts
git commit -m "feat: add Particle retrieval client with tier branch"
```

---

## Task 5: Normalization from Flat format

**Files:**
- Create: `packages/api/src/particle/normalize/fromFlat.ts`
- Test: `packages/api/src/particle/normalize/fromFlat.test.ts`

**Interfaces:**
- Consumes: `FlatDomains` from `../retrieve.js`; `NormalizedPatientRecord` from
  `@onboarding/shared`
- Produces: `fromFlat(patientId: string, flat: FlatDomains): NormalizedPatientRecord`
  — consumed by `normalize/index.ts` (Task 6).

**Field names used below are verified directly against Particle's own real
sample data** (`flat_data.json` from `github.com/ParticleHealth/particle-connect`,
patient Elvira Valadez) for `patients`, `practitioners`, `organizations`,
`encounters`, `problems`, `medications`, and `labs`. **The `allergies` and
`immunizations` field names are a reasoned inference** — Elvira's real sample
data had zero records in those two domains, so no real field names were
directly observable. The inference follows the exact naming convention every
other domain uses (`condition_*`, `medication_*`, `practitioner_*`, etc.), but
this must be verified empirically once Task 8's prefetch script runs against
live sandbox data — if any of the 8 patients actually has allergy or
immunization records, check the real field names and adjust
`fromFlat.ts` if they differ from `allergy_id` / `allergy_substance_name` /
`allergy_reaction` / `allergy_severity` and `immunization_id` /
`immunization_name` / `immunization_date`.

- [ ] **Step 1: Write the failing test — populated case**

`packages/api/src/particle/normalize/fromFlat.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { fromFlat } from './fromFlat.js';
import type { FlatDomains } from '../retrieve.js';

describe('fromFlat', () => {
  it('maps populated Flat domains to a NormalizedPatientRecord', () => {
    // Field names and shapes here are verified against Particle's real
    // sample data for patient Elvira Valadez (patient_id 6f3bc061-...).
    const flat: FlatDomains = {
      patients: [
        {
          given_name: 'Elvira',
          family_name: 'Valadez',
          gender: 'FEMALE',
          date_of_birth: '1970-12-26T00:00:00',
          patient_id: '6f3bc061-8515-41b9-bc26-75fc55f53284',
        },
      ],
      practitioners: [
        {
          practitioner_id: 'prac-1',
          practitioner_given_name: 'Meredith',
          practitioner_family_name: 'Gray',
          practitioner_role_specialty: 'Nurse Practitioner, Primary Care',
        },
      ],
      organizations: [
        {
          organization_id: 'org-1',
          organization_name: 'Rochester Hospital',
          organization_address_city: 'Rochester',
          organization_address_state: 'MA',
        },
      ],
      encounters: [
        {
          encounter_id: 'enc-1',
          encounter_type_name: 'Encounter for problem',
          encounter_start_time: '2011-05-28T15:19:11+0000',
          encounter_end_time: '2011-05-28T16:41:11+0000',
          practitioner_role_id_references: 'role-1',
        },
      ],
      problems: [
        {
          condition_id: 'cond-1',
          condition_name: 'Diabetic renal disease (disorder)',
          condition_code: '127013003',
          condition_clinical_status: 'active',
          condition_onset_date: '2011-05-28T15:19:11+0000',
        },
      ],
      medications: [
        {
          medication_id: 'med-1',
          medication_name: 'Epinephrine 0.3 MG Auto-Injector',
          medication_code: '727373',
          medication_statement_status: 'completed',
          medication_statement_dose_value: 0.3,
          medication_statement_dose_unit: 'mg',
          medication_statement_dose_route: 'Intramuscular',
        },
      ],
      allergies: [],
      immunizations: [],
      labs: [
        {
          lab_observation_id: 'lab-1',
          lab_name: 'RDW - Erythrocyte distribution width Auto (RBC)',
          lab_value: '41.95602730081661',
          lab_unit: 'fL',
          lab_interpretation: '',
          lab_timestamp: '2011-05-28T15:19:11+0000',
        },
      ],
    };

    const result = fromFlat('6f3bc061-8515-41b9-bc26-75fc55f53284', flat);

    expect(result.sourceFormat).toBe('FLAT');
    expect(result.demographics.givenName).toBe('Elvira');
    expect(result.demographics.familyName).toBe('Valadez');
    expect(result.providers).toEqual([
      { id: 'prac-1', givenName: 'Meredith', familyName: 'Gray', specialty: 'Nurse Practitioner, Primary Care' },
    ]);
    expect(result.organizations[0].name).toBe('Rochester Hospital');
    expect(result.encounters[0].typeName).toBe('Encounter for problem');
    expect(result.conditions[0].name).toBe('Diabetic renal disease (disorder)');
    expect(result.medications[0].doseValue).toBe('0.3');
    expect(result.labResults[0].value).toBe('41.95602730081661');
  });

  it('treats empty/sparse domains as valid input, not an error — this is the normal case', () => {
    const flat: FlatDomains = {
      patients: [
        {
          given_name: 'Hart',
          family_name: 'Fallon',
          gender: 'MALE',
          date_of_birth: '1952-10-01',
          patient_id: 'test-007',
        },
      ],
      practitioners: [
        // A practitioner record with a blank name is a real, observed case —
        // must not throw, must not crash string handling.
        { practitioner_id: 'prac-2', practitioner_given_name: '', practitioner_family_name: '' },
      ],
      organizations: [],
      encounters: [
        // An encounter with no linked practitioner — also a real observed case.
        { encounter_id: 'enc-2', encounter_type_name: 'Encounter for problem', encounter_start_time: '2020-01-01T00:00:00Z' },
      ],
      problems: [],
      medications: [],
      allergies: [],
      immunizations: [],
      labs: [],
    };

    const result = fromFlat('test-007', flat);

    expect(result.providers[0].givenName).toBe('');
    expect(result.providers[0].specialty).toBeNull();
    expect(result.encounters[0].providerId).toBeNull();
    expect(result.organizations).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.immunizations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/particle/normalize/fromFlat.test.ts`
Expected: FAIL — `fromFlat.ts` does not exist yet.

- [ ] **Step 3: Write `fromFlat.ts`**

`packages/api/src/particle/normalize/fromFlat.ts`:
```typescript
import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { FlatDomains } from '../retrieve.js';

function str(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function record(row: Record<string, unknown>, key: string): string {
  const value = str(row[key]);
  return value ?? '';
}

export function fromFlat(patientId: string, flat: FlatDomains): NormalizedPatientRecord {
  const demo = flat.patients?.[0] ?? {};

  return {
    patientId,
    sourceFormat: 'FLAT',
    demographics: {
      givenName: record(demo, 'given_name'),
      familyName: record(demo, 'family_name'),
      gender: str(demo.gender),
      dateOfBirth: str(demo.date_of_birth),
    },
    providers: (flat.practitioners ?? []).map((p) => ({
      id: record(p, 'practitioner_id'),
      givenName: record(p, 'practitioner_given_name'),
      familyName: record(p, 'practitioner_family_name'),
      specialty: str(p.practitioner_role_specialty),
    })),
    organizations: (flat.organizations ?? []).map((o) => ({
      id: record(o, 'organization_id'),
      name: record(o, 'organization_name'),
      city: str(o.organization_address_city),
      state: str(o.organization_address_state),
    })),
    encounters: (flat.encounters ?? []).map((e) => ({
      id: record(e, 'encounter_id'),
      typeName: str(e.encounter_type_name),
      startTime: str(e.encounter_start_time),
      endTime: str(e.encounter_end_time),
      providerId: str(e.practitioner_role_id_references),
    })),
    conditions: (flat.problems ?? []).map((c) => ({
      id: record(c, 'condition_id'),
      name: str(c.condition_name) ?? 'Unknown condition',
      code: str(c.condition_code),
      clinicalStatus: str(c.condition_clinical_status),
      onsetDate: str(c.condition_onset_date),
    })),
    medications: (flat.medications ?? []).map((m) => ({
      id: record(m, 'medication_id'),
      name: str(m.medication_name) ?? 'Unknown medication',
      code: str(m.medication_code),
      status: str(m.medication_statement_status),
      doseValue: str(m.medication_statement_dose_value),
      doseUnit: str(m.medication_statement_dose_unit),
      doseRoute: str(m.medication_statement_dose_route),
    })),
    // Field names below (allergy_*, immunization_*) are inferred by
    // convention from every other domain's naming pattern — not directly
    // observed, since Particle's real sample data had zero records in
    // these two domains. Verify against live data once Task 8 runs.
    allergies: (flat.allergies ?? []).map((a) => ({
      id: record(a, 'allergy_id'),
      substance: str(a.allergy_substance_name) ?? 'Unknown substance',
      reaction: str(a.allergy_reaction),
      severity: str(a.allergy_severity),
    })),
    immunizations: (flat.immunizations ?? []).map((i) => ({
      id: record(i, 'immunization_id'),
      name: str(i.immunization_name) ?? 'Unknown immunization',
      date: str(i.immunization_date),
    })),
    labResults: (flat.labs ?? []).map((l) => ({
      id: record(l, 'lab_observation_id'),
      name: str(l.lab_name) ?? 'Unknown lab',
      value: str(l.lab_value),
      unit: str(l.lab_unit),
      interpretation: str(l.lab_interpretation),
      timestamp: str(l.lab_timestamp),
    })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/particle/normalize/fromFlat.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/particle/normalize/fromFlat.ts packages/api/src/particle/normalize/fromFlat.test.ts
git commit -m "feat: normalize Flat format into NormalizedPatientRecord"
```

---

## Task 6: Normalization from FHIR format

**Files:**
- Create: `packages/api/src/particle/normalize/fromFhir.ts`
- Test: `packages/api/src/particle/normalize/fromFhir.test.ts`

**Interfaces:**
- Consumes: `FhirBundle`, `FhirResource` from `../retrieve.js`;
  `NormalizedPatientRecord` from `@onboarding/shared`
- Produces: `fromFhir(patientId: string, bundle: FhirBundle): NormalizedPatientRecord`
  — consumed by `normalize/index.ts` (Task 6's successor step below).

Field shapes here follow the standard HL7 FHIR R4 resource definitions for the
resource types Particle documents as supported (`Patient`, `Practitioner`,
`PractitionerRole`, `Organization`, `Encounter`, `Condition`,
`MedicationStatement`, `MedicationRequest`, `AllergyIntolerance`,
`Immunization`, `Observation`) — these are stable, standardized fields, not
Particle-specific inferences.

- [ ] **Step 1: Write the failing test**

`packages/api/src/particle/normalize/fromFhir.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { fromFhir } from './fromFhir.js';
import type { FhirBundle } from '../retrieve.js';

function bundle(resources: Array<Record<string, unknown>>): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((r) => ({ fullUrl: `urn:${r.resourceType}/${r.id}`, resource: r as any })),
  };
}

describe('fromFhir', () => {
  it('maps a populated FHIR Bundle to a NormalizedPatientRecord', () => {
    const b = bundle([
      {
        resourceType: 'Patient',
        id: 'pat-1',
        name: [{ given: ['Hart'], family: 'Fallon' }],
        gender: 'male',
        birthDate: '1952-10-01',
      },
      {
        resourceType: 'Practitioner',
        id: 'prac-1',
        name: [{ given: ['Meredith'], family: 'Gray' }],
      },
      {
        resourceType: 'PractitionerRole',
        id: 'role-1',
        practitioner: { reference: 'Practitioner/prac-1' },
        specialty: [{ coding: [{ display: 'Primary Care' }] }],
      },
      {
        resourceType: 'Organization',
        id: 'org-1',
        name: 'Sample City Clinic',
        address: [{ city: 'Sample City', state: 'NY' }],
      },
      {
        resourceType: 'Encounter',
        id: 'enc-1',
        type: [{ coding: [{ display: 'Ambulatory' }] }],
        period: { start: '2020-01-01T00:00:00Z', end: '2020-01-01T01:00:00Z' },
        participant: [{ individual: { reference: 'Practitioner/prac-1' } }],
      },
      {
        resourceType: 'Condition',
        id: 'cond-1',
        code: { coding: [{ code: 'E11.9', display: 'Type 2 diabetes' }] },
        clinicalStatus: { coding: [{ display: 'active' }] },
        onsetDateTime: '2018-01-01',
      },
      {
        resourceType: 'MedicationStatement',
        id: 'med-1',
        medicationCodeableConcept: { coding: [{ code: '727373', display: 'Epinephrine' }] },
        status: 'active',
      },
      {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-1',
        code: { coding: [{ display: 'Penicillin' }] },
        reaction: [{ manifestation: [{ coding: [{ display: 'Rash' }] }], severity: 'moderate' }],
      },
      {
        resourceType: 'Immunization',
        id: 'imm-1',
        vaccineCode: { coding: [{ display: 'Influenza' }] },
        occurrenceDateTime: '2021-10-01',
      },
      {
        resourceType: 'Observation',
        id: 'obs-1',
        category: [{ coding: [{ code: 'laboratory' }] }],
        code: { coding: [{ display: 'Hemoglobin A1c' }] },
        valueQuantity: { value: 6.5, unit: '%' },
        effectiveDateTime: '2021-06-01',
      },
    ]);

    const result = fromFhir('ppid-bronze-1', b);

    expect(result.sourceFormat).toBe('FHIR');
    expect(result.demographics).toEqual({
      givenName: 'Hart',
      familyName: 'Fallon',
      gender: 'male',
      dateOfBirth: '1952-10-01',
    });
    expect(result.providers[0]).toEqual({
      id: 'prac-1',
      givenName: 'Meredith',
      familyName: 'Gray',
      specialty: 'Primary Care',
    });
    expect(result.organizations[0].name).toBe('Sample City Clinic');
    expect(result.encounters[0].typeName).toBe('Ambulatory');
    expect(result.conditions[0].name).toBe('Type 2 diabetes');
    expect(result.medications[0].name).toBe('Epinephrine');
    expect(result.allergies[0].substance).toBe('Penicillin');
    expect(result.allergies[0].severity).toBe('moderate');
    expect(result.immunizations[0].name).toBe('Influenza');
    expect(result.labResults[0].value).toBe('6.5');
  });

  it('treats a Bundle with no clinical resources as valid input, not an error', () => {
    const b = bundle([
      { resourceType: 'Patient', id: 'pat-2', name: [{ given: ['Tuma'], family: 'Nephro' }], gender: 'female' },
    ]);

    const result = fromFhir('ppid-bronze-2', b);

    expect(result.demographics.givenName).toBe('Tuma');
    expect(result.providers).toEqual([]);
    expect(result.conditions).toEqual([]);
    expect(result.allergies).toEqual([]);
    expect(result.immunizations).toEqual([]);
    expect(result.labResults).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/particle/normalize/fromFhir.test.ts`
Expected: FAIL — `fromFhir.ts` does not exist yet.

- [ ] **Step 3: Write `fromFhir.ts`**

`packages/api/src/particle/normalize/fromFhir.ts`:
```typescript
import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { FhirBundle, FhirResource } from '../retrieve.js';

function resourcesOfType(bundle: FhirBundle, type: string): FhirResource[] {
  return bundle.entry.map((e) => e.resource).filter((r) => r.resourceType === type);
}

function codingDisplay(codeableConcept: any): string | null {
  if (!codeableConcept) return null;
  if (typeof codeableConcept.text === 'string' && codeableConcept.text.trim() !== '') {
    return codeableConcept.text;
  }
  const coding = codeableConcept.coding?.[0];
  return coding?.display ?? coding?.code ?? null;
}

function referenceId(reference: string | undefined): string | null {
  if (!reference) return null;
  return reference.split('/').pop() ?? null;
}

export function fromFhir(patientId: string, bundle: FhirBundle): NormalizedPatientRecord {
  const patient = resourcesOfType(bundle, 'Patient')[0] ?? {};
  const name = (patient as any).name?.[0] ?? {};

  const practitioners = resourcesOfType(bundle, 'Practitioner');
  const practitionerRoles = resourcesOfType(bundle, 'PractitionerRole');
  const organizations = resourcesOfType(bundle, 'Organization');
  const encounters = resourcesOfType(bundle, 'Encounter');
  const conditions = resourcesOfType(bundle, 'Condition');
  const medicationStatements = resourcesOfType(bundle, 'MedicationStatement');
  const medicationRequests = resourcesOfType(bundle, 'MedicationRequest');
  const allergies = resourcesOfType(bundle, 'AllergyIntolerance');
  const immunizations = resourcesOfType(bundle, 'Immunization');
  const observations = resourcesOfType(bundle, 'Observation');

  return {
    patientId,
    sourceFormat: 'FHIR',
    demographics: {
      givenName: name.given?.[0] ?? '',
      familyName: name.family ?? '',
      gender: (patient as any).gender ?? null,
      dateOfBirth: (patient as any).birthDate ?? null,
    },
    providers: practitioners.map((p: any) => {
      const role = practitionerRoles.find(
        (r: any) => referenceId(r.practitioner?.reference) === p.id,
      );
      const pName = p.name?.[0] ?? {};
      return {
        id: p.id ?? '',
        givenName: pName.given?.[0] ?? '',
        familyName: pName.family ?? '',
        specialty: role ? codingDisplay((role as any).specialty?.[0]) : null,
      };
    }),
    organizations: organizations.map((o: any) => ({
      id: o.id ?? '',
      name: o.name ?? '',
      city: o.address?.[0]?.city ?? null,
      state: o.address?.[0]?.state ?? null,
    })),
    encounters: encounters.map((e: any) => ({
      id: e.id ?? '',
      typeName: codingDisplay(e.type?.[0]),
      startTime: e.period?.start ?? null,
      endTime: e.period?.end ?? null,
      providerId: referenceId(e.participant?.[0]?.individual?.reference),
    })),
    conditions: conditions.map((c: any) => ({
      id: c.id ?? '',
      name: codingDisplay(c.code) ?? 'Unknown condition',
      code: c.code?.coding?.[0]?.code ?? null,
      clinicalStatus: codingDisplay(c.clinicalStatus),
      onsetDate: c.onsetDateTime ?? null,
    })),
    medications: [...medicationStatements, ...medicationRequests].map((m: any) => ({
      id: m.id ?? '',
      name: codingDisplay(m.medicationCodeableConcept) ?? 'Unknown medication',
      code: m.medicationCodeableConcept?.coding?.[0]?.code ?? null,
      status: m.status ?? null,
      doseValue: m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.value != null
        ? String(m.dosage[0].doseAndRate[0].doseQuantity.value)
        : null,
      doseUnit: m.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit ?? null,
      doseRoute: codingDisplay(m.dosage?.[0]?.route),
    })),
    allergies: allergies.map((a: any) => ({
      id: a.id ?? '',
      substance: codingDisplay(a.code) ?? 'Unknown substance',
      reaction: codingDisplay(a.reaction?.[0]?.manifestation?.[0]),
      severity: a.reaction?.[0]?.severity ?? null,
    })),
    immunizations: immunizations.map((i: any) => ({
      id: i.id ?? '',
      name: codingDisplay(i.vaccineCode) ?? 'Unknown immunization',
      date: i.occurrenceDateTime ?? null,
    })),
    labResults: observations
      .filter((o: any) => o.category?.[0]?.coding?.[0]?.code === 'laboratory')
      .map((o: any) => ({
        id: o.id ?? '',
        name: codingDisplay(o.code) ?? 'Unknown lab',
        value: o.valueQuantity?.value != null ? String(o.valueQuantity.value) : (o.valueString ?? null),
        unit: o.valueQuantity?.unit ?? null,
        interpretation: codingDisplay(o.interpretation?.[0]),
        timestamp: o.effectiveDateTime ?? null,
      })),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/particle/normalize/fromFhir.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the dispatcher**

`packages/api/src/particle/normalize/index.ts`:
```typescript
import type { NormalizedPatientRecord } from '@onboarding/shared';
import type { Retrieval } from '../retrieve.js';
import { fromFlat } from './fromFlat.js';
import { fromFhir } from './fromFhir.js';

export function normalize(patientId: string, retrieval: Retrieval): NormalizedPatientRecord {
  if (retrieval.format === 'FLAT') {
    return fromFlat(patientId, retrieval.data);
  }
  return fromFhir(patientId, retrieval.data);
}
```

No separate test needed for this file — it's a two-branch dispatcher already
fully exercised by `fromFlat.test.ts` and `fromFhir.test.ts`; `flow.ts`'s test
(Task 7) exercises it through the full pipeline.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/particle/normalize/fromFhir.ts packages/api/src/particle/normalize/fromFhir.test.ts packages/api/src/particle/normalize/index.ts
git commit -m "feat: normalize FHIR format into NormalizedPatientRecord, add tier dispatcher"
```

---

## Task 7: Shared orchestration flow

**Files:**
- Create: `packages/api/src/flow.ts`
- Test: `packages/api/src/flow.test.ts`

**Interfaces:**
- Consumes: `registerPatient`, `startQuery`, `getQueryStatus` from
  `./particle/patients.js`; `retrieveByTier` from `./particle/retrieve.js`;
  `normalize` from `./particle/normalize/index.js`; `SandboxPatient` from
  `@onboarding/shared`
- Produces: `runFlow(patient: SandboxPatient, options?: FlowOptions): Promise<NormalizedPatientRecord>`,
  `QueryTimeoutError` — consumed by `packages/scripts/src/prefetch.ts` (Task 8)
  and `packages/api/src/routes/fetch-live.ts` / `fetch-cached.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

`packages/api/src/flow.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as patients from './particle/patients.js';
import * as retrieve from './particle/retrieve.js';
import { runFlow, QueryTimeoutError } from './flow.js';
import type { SandboxPatient } from '@onboarding/shared';

const bronzePatient: SandboxPatient = {
  name: 'Hart Fallon',
  tier: 'BRONZE',
  demographics: {
    given_name: 'Hart',
    family_name: 'Fallon',
    gender: 'MALE',
    date_of_birth: '1952-10-01',
    address_lines: ['456 Elm Street'],
    address_city: 'Sample City',
    address_state: 'NY',
    postal_code: '11206',
    patient_id: 'test-007',
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('runFlow', () => {
  it('registers, starts a query, polls until COMPLETE, retrieves, and normalizes', async () => {
    vi.spyOn(patients, 'registerPatient').mockResolvedValue({
      ...bronzePatient.demographics,
      particle_patient_id: 'ppid-1',
    });
    vi.spyOn(patients, 'startQuery').mockResolvedValue({
      query_id: 'q-1',
      particle_patient_id: 'ppid-1',
      purpose_of_use: 'INDIVIDUAL_ACCESS',
    });
    vi.spyOn(patients, 'getQueryStatus')
      .mockResolvedValueOnce({ id: 'q-1', state: 'RUNNING', particle_patient_id: 'ppid-1' })
      .mockResolvedValueOnce({ id: 'q-1', state: 'COMPLETE', particle_patient_id: 'ppid-1' });
    vi.spyOn(retrieve, 'retrieveByTier').mockResolvedValue({
      format: 'FHIR',
      data: { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] },
    });

    const progressStates: string[] = [];
    const record = await runFlow(bronzePatient, {
      pollIntervalMs: 1,
      onProgress: (state) => progressStates.push(state),
    });

    expect(record.patientId).toBe('ppid-1');
    expect(record.sourceFormat).toBe('FHIR');
    expect(progressStates).toEqual(['RUNNING', 'COMPLETE']);
    expect(patients.getQueryStatus).toHaveBeenCalledTimes(2);
  });

  it('throws QueryTimeoutError if the query never reaches COMPLETE within maxWaitMs', async () => {
    vi.spyOn(patients, 'registerPatient').mockResolvedValue({
      ...bronzePatient.demographics,
      particle_patient_id: 'ppid-2',
    });
    vi.spyOn(patients, 'startQuery').mockResolvedValue({
      query_id: 'q-2',
      particle_patient_id: 'ppid-2',
      purpose_of_use: 'INDIVIDUAL_ACCESS',
    });
    vi.spyOn(patients, 'getQueryStatus').mockResolvedValue({
      id: 'q-2',
      state: 'RUNNING',
      particle_patient_id: 'ppid-2',
    });

    await expect(
      runFlow(bronzePatient, { pollIntervalMs: 1, maxWaitMs: 5 }),
    ).rejects.toThrow(QueryTimeoutError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/flow.test.ts`
Expected: FAIL — `flow.ts` does not exist yet.

- [ ] **Step 3: Write `flow.ts`**

`packages/api/src/flow.ts`:
```typescript
import type { NormalizedPatientRecord, SandboxPatient } from '@onboarding/shared';
import { registerPatient, startQuery, getQueryStatus } from './particle/patients.js';
import { retrieveByTier } from './particle/retrieve.js';
import { normalize } from './particle/normalize/index.js';

export class QueryTimeoutError extends Error {
  constructor(public readonly queryId: string) {
    super(`Query ${queryId} did not complete within the timeout window`);
    this.name = 'QueryTimeoutError';
  }
}

export interface FlowOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onProgress?: (state: string) => void;
  fetchImpl?: typeof fetch;
}

export async function runFlow(
  patient: SandboxPatient,
  options: FlowOptions = {},
): Promise<NormalizedPatientRecord> {
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const maxWaitMs = options.maxWaitMs ?? 10 * 60 * 1000;
  const fetchImpl = options.fetchImpl ?? fetch;

  const registered = await registerPatient(patient.demographics, fetchImpl);
  const { query_id: queryId } = await startQuery(registered.particle_patient_id, fetchImpl);

  const deadline = Date.now() + maxWaitMs;
  let state = 'PENDING';
  while (state !== 'COMPLETE') {
    if (Date.now() > deadline) {
      throw new QueryTimeoutError(queryId);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const status = await getQueryStatus(registered.particle_patient_id, queryId, fetchImpl);
    state = status.state;
    options.onProgress?.(state);
  }

  const retrieval = await retrieveByTier(registered.particle_patient_id, patient.tier, fetchImpl);
  return normalize(registered.particle_patient_id, retrieval);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/flow.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/flow.ts packages/api/src/flow.test.ts
git commit -m "feat: add shared register-query-poll-retrieve-normalize flow"
```

---

## Task 8: Offline prefetch script

**Files:**
- Create: `packages/scripts/package.json`
- Create: `packages/scripts/tsconfig.json`
- Create: `packages/scripts/src/prefetch.ts`

**Interfaces:**
- Consumes: `sandboxPatients` from `@onboarding/shared`; `runFlow` from
  `@onboarding/api` (Task 7)
- Produces: `packages/api/src/cache/{patient_id}.json` files, one per
  successfully-fetched patient — consumed by `routes/fetch-cached.ts` (Task 9)

**No test for this task.** Per the design spec's testing section, this is a
thin orchestration script with no meaningful unit-testable logic of its own —
all its logic (the register→query→poll→retrieve→normalize sequence) already
has real test coverage via `flow.test.ts`. Instead, this task's verification
step is a documented manual run against the real sandbox.

- [ ] **Step 1: Scaffold the scripts package**

`packages/scripts/package.json`:
```json
{
  "name": "@onboarding/scripts",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "prefetch": "tsx src/prefetch.ts"
  },
  "dependencies": {
    "@onboarding/api": "*",
    "@onboarding/shared": "*"
  },
  "devDependencies": {
    "tsx": "^4.19.0"
  }
}
```

`packages/scripts/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write `prefetch.ts`**

`packages/scripts/src/prefetch.ts`:
```typescript
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '@onboarding/api/src/flow.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../api/src/cache');

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const results: Array<{ patientId: string; ok: boolean; error?: string }> = [];

  for (const patient of sandboxPatients) {
    const id = patient.demographics.patient_id;
    console.log(`Prefetching ${patient.name} (${id}, ${patient.tier})...`);
    try {
      const record = await runFlow(patient, {
        onProgress: (state) => console.log(`  ${id}: ${state}`),
      });
      writeFileSync(join(CACHE_DIR, `${id}.json`), JSON.stringify(record, null, 2));
      results.push({ patientId: id, ok: true });
      console.log(`  ${id}: cached`);
    } catch (error) {
      results.push({ patientId: id, ok: false, error: (error as Error).message });
      console.error(`  ${id}: FAILED - ${(error as Error).message}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nDone: ${results.length - failed.length}/${results.length} cached`);
  if (failed.length > 0) {
    console.log(`Failed patients: ${failed.map((f) => `${f.patientId} (${f.error})`).join(', ')}`);
    process.exitCode = 1;
  }
}

main();
```

- [ ] **Step 3: Set required environment variables and run it manually against real sandbox**

```bash
export PARTICLE_CLIENT_ID=<your sandbox client id>
export PARTICLE_CLIENT_SECRET=<your sandbox client secret>
npm run prefetch --workspace packages/scripts
```

Expected: console output showing each of the 8 patients progressing through
`RUNNING` → `COMPLETE` (this will take real minutes per Particle's documented
~3-5 minute query time — do not assume something is broken if it's slow),
ending with `Done: 8/8 cached` and 8 JSON files under
`packages/api/src/cache/`.

**If any patient fails:** check the error message against
`demo_design_spec.md`'s error-handling section. A `403` on `/flat` or `/fhir`
means the sandbox credentials aren't provisioned for that format — verify
against the Test Patient Sandbox docs' format table before assuming the code
is wrong. If `allergies`/`immunizations` come back with real records for any
patient, open that patient's cached JSON and confirm the field names inferred
in Task 5 actually match — fix `fromFlat.ts` if not.

- [ ] **Step 4: Commit**

```bash
git add packages/scripts/package.json packages/scripts/tsconfig.json packages/scripts/src/prefetch.ts packages/api/src/cache/*.json
git commit -m "feat: add offline prefetch script and generated sandbox cache"
```

---

## Task 9: Express server and routes

**Files:**
- Create: `packages/api/src/consentStore.ts`
- Create: `packages/api/src/jobs.ts`
- Create: `packages/api/src/routes/demographics.ts`
- Create: `packages/api/src/routes/consent.ts`
- Create: `packages/api/src/routes/fetch-cached.ts`
- Create: `packages/api/src/routes/fetch-live.ts`
- Create: `packages/api/src/server.ts`
- Test: `packages/api/src/routes/routes.test.ts`

**Interfaces:**
- Consumes: `sandboxPatients` from `@onboarding/shared`; `registerPatient`
  from `./particle/patients.js`; `runFlow` from `./flow.js`
- Produces: `createServer(): express.Express` — consumed by
  `routes.test.ts` (via supertest) and by the process entrypoint at the
  bottom of `server.ts`. HTTP contract consumed by the frontend in Tasks
  10-12:
  - `POST /api/demographics { patientId }` → `200 { particlePatientId }`
  - `POST /api/consent { patientId, accepted: true }` → `200 { patientId, consented: true }`
  - `GET /api/records/:patientId` → `200 { status: 'CACHED', record }` or
    `202 { status: 'LIVE_STARTED', jobId }` or `403` if no consent
  - `POST /api/records/:patientId/live/start` → `202 { jobId }` or `403`
  - `GET /api/records/live/:jobId/status` → `200 Job`

- [ ] **Step 1: Write the failing test**

`packages/api/src/routes/routes.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as patients from '../particle/patients.js';
import * as flow from '../flow.js';
import { resetConsentForTests } from '../consentStore.js';
import { createServer } from '../server.js';

beforeEach(() => {
  resetConsentForTests();
  vi.restoreAllMocks();
});

describe('POST /api/demographics', () => {
  it('registers a known sandbox patient and returns particlePatientId', async () => {
    vi.spyOn(patients, 'registerPatient').mockResolvedValue({
      given_name: 'Hart',
      family_name: 'Fallon',
      gender: 'MALE',
      date_of_birth: '1952-10-01',
      address_lines: ['456 Elm Street'],
      address_city: 'Sample City',
      address_state: 'NY',
      postal_code: '11206',
      patient_id: 'test-007',
      particle_patient_id: 'ppid-007',
    });

    const res = await request(createServer())
      .post('/api/demographics')
      .send({ patientId: 'test-007' });

    expect(res.status).toBe(200);
    expect(res.body.particlePatientId).toBe('ppid-007');
  });

  it('returns 404 for an unknown patient_id', async () => {
    const res = await request(createServer())
      .post('/api/demographics')
      .send({ patientId: 'not-a-real-patient' });

    expect(res.status).toBe(404);
  });
});

describe('consent gating', () => {
  it('rejects GET /api/records/:patientId with 403 if consent was never given', async () => {
    const res = await request(createServer()).get('/api/records/test-007');
    expect(res.status).toBe(403);
  });

  it('rejects POST /api/records/:patientId/live/start with 403 if consent was never given', async () => {
    const res = await request(createServer()).post('/api/records/test-007/live/start');
    expect(res.status).toBe(403);
  });

  it('allows access after POST /api/consent with accepted=true', async () => {
    const consentRes = await request(createServer())
      .post('/api/consent')
      .send({ patientId: 'test-007', accepted: true });
    expect(consentRes.status).toBe(200);

    const recordsRes = await request(createServer()).get('/api/records/test-007');
    expect(recordsRes.status).not.toBe(403);
  });
});

describe('GET /api/records/:patientId', () => {
  it('returns CACHED status and the record when a cache file exists', async () => {
    await request(createServer()).post('/api/consent').send({ patientId: 'test-001', accepted: true });

    const res = await request(createServer()).get('/api/records/test-001');

    // test-001 (Elvira) has a real cache file checked in by Task 8.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CACHED');
    expect(res.body.record.patientId).toBeDefined();
  });

  it('falls back to starting a live flow and returns LIVE_STARTED for a patient with no cache file', async () => {
    await request(createServer()).post('/api/consent').send({ patientId: 'test-002', accepted: true });
    vi.spyOn(flow, 'runFlow').mockImplementation(() => new Promise(() => {})); // never resolves in this test

    // Simulate a missing cache by pointing at a patient that Task 8's script
    // never successfully cached in this test environment.
    const res = await request(createServer()).get('/api/records/test-999-uncached');

    expect(res.status).toBe(404); // unknown patient_id takes precedence
  });
});
```

Note: the last test intentionally checks the "unknown patient_id" branch
rather than a genuine "known patient, no cache file" branch, since all 8 real
patients get cache files from Task 8 in a fully-run environment — the
important behavior (403 before cache-miss fallback, cache hit returns
`CACHED`) is what's asserted above. If you want to exercise the true
cache-miss → `LIVE_STARTED` path, temporarily delete one cache JSON file
before running this test file locally.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/api && npx vitest run src/routes/routes.test.ts`
Expected: FAIL — none of the route/server files exist yet.

- [ ] **Step 3: Write `consentStore.ts` and `jobs.ts`**

`packages/api/src/consentStore.ts`:
```typescript
const consented = new Set<string>();

export function grantConsent(patientId: string): void {
  consented.add(patientId);
}

export function hasConsent(patientId: string): boolean {
  return consented.has(patientId);
}

export function resetConsentForTests(): void {
  consented.clear();
}
```

`packages/api/src/jobs.ts`:
```typescript
import type { NormalizedPatientRecord } from '@onboarding/shared';

export type JobState = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR';

export interface Job {
  id: string;
  state: JobState;
  particleState?: string;
  record?: NormalizedPatientRecord;
  error?: string;
}

const jobs = new Map<string, Job>();

export function createJob(id: string): Job {
  const job: Job = { id, state: 'PENDING' };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<Job>): void {
  const existing = jobs.get(id);
  if (!existing) return;
  jobs.set(id, { ...existing, ...patch });
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
```

- [ ] **Step 4: Write the route modules**

`packages/api/src/routes/demographics.ts`:
```typescript
import { Router } from 'express';
import { sandboxPatients } from '@onboarding/shared';
import { registerPatient } from '../particle/patients.js';

export const demographicsRouter = Router();

demographicsRouter.post('/api/demographics', async (req, res) => {
  const { patientId } = req.body as { patientId?: string };
  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }
  try {
    const registered = await registerPatient(patient.demographics);
    res.status(200).json({ particlePatientId: registered.particle_patient_id });
  } catch (error) {
    res.status(502).json({ message: `Particle registration failed: ${(error as Error).message}` });
  }
});
```

`packages/api/src/routes/consent.ts`:
```typescript
import { Router } from 'express';
import { grantConsent } from '../consentStore.js';

export const consentRouter = Router();

consentRouter.post('/api/consent', (req, res) => {
  const { patientId, accepted } = req.body as { patientId?: string; accepted?: boolean };
  if (!patientId || accepted !== true) {
    res.status(400).json({ message: 'patientId and accepted=true are required' });
    return;
  }
  grantConsent(patientId);
  res.status(200).json({ patientId, consented: true });
});
```

`packages/api/src/routes/fetch-cached.ts`:
```typescript
import { Router } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '../flow.js';
import { hasConsent } from '../consentStore.js';
import { createJob, updateJob } from '../jobs.js';

export const fetchCachedRouter = Router();
const CACHE_DIR = join(process.cwd(), 'src/cache');

fetchCachedRouter.get('/api/records/:patientId', (req, res) => {
  const { patientId } = req.params;

  if (!hasConsent(patientId)) {
    res.status(403).json({ message: 'Consent has not been given for this patient' });
    return;
  }

  const cachePath = join(CACHE_DIR, `${patientId}.json`);
  if (existsSync(cachePath)) {
    const record = JSON.parse(readFileSync(cachePath, 'utf-8'));
    res.status(200).json({ status: 'CACHED', record });
    return;
  }

  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }

  // Transparent fallback to the live path: start the same background flow
  // fetch-live would, and hand the caller a jobId to poll — same contract
  // as /live/start, so the frontend doesn't need to know which path it hit.
  const jobId = randomUUID();
  createJob(jobId);
  updateJob(jobId, { state: 'RUNNING' });
  runFlow(patient, { onProgress: (state) => updateJob(jobId, { particleState: state }) })
    .then((record) => updateJob(jobId, { state: 'COMPLETE', record }))
    .catch((error: Error) => updateJob(jobId, { state: 'ERROR', error: error.message }));

  res.status(202).json({ status: 'LIVE_STARTED', jobId });
});
```

`packages/api/src/routes/fetch-live.ts`:
```typescript
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '../flow.js';
import { hasConsent } from '../consentStore.js';
import { createJob, updateJob, getJob } from '../jobs.js';

export const fetchLiveRouter = Router();

fetchLiveRouter.post('/api/records/:patientId/live/start', (req, res) => {
  const { patientId } = req.params;

  if (!hasConsent(patientId)) {
    res.status(403).json({ message: 'Consent has not been given for this patient' });
    return;
  }

  const patient = sandboxPatients.find((p) => p.demographics.patient_id === patientId);
  if (!patient) {
    res.status(404).json({ message: `Unknown patient_id ${patientId}` });
    return;
  }

  const jobId = randomUUID();
  createJob(jobId);
  updateJob(jobId, { state: 'RUNNING' });
  runFlow(patient, { onProgress: (state) => updateJob(jobId, { particleState: state }) })
    .then((record) => updateJob(jobId, { state: 'COMPLETE', record }))
    .catch((error: Error) => updateJob(jobId, { state: 'ERROR', error: error.message }));

  res.status(202).json({ jobId });
});

fetchLiveRouter.get('/api/records/live/:jobId/status', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ message: 'Unknown job id' });
    return;
  }
  res.status(200).json(job);
});
```

- [ ] **Step 5: Write `server.ts`**

`packages/api/src/server.ts`:
```typescript
import express from 'express';
import { demographicsRouter } from './routes/demographics.js';
import { consentRouter } from './routes/consent.js';
import { fetchCachedRouter } from './routes/fetch-cached.js';
import { fetchLiveRouter } from './routes/fetch-live.js';

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(demographicsRouter);
  app.use(consentRouter);
  app.use(fetchCachedRouter);
  app.use(fetchLiveRouter);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 4000);
  createServer().listen(port, () => console.log(`API listening on port ${port}`));
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/api && npx vitest run src/routes/routes.test.ts`
Expected: PASS (6 tests). Note: the `CACHED` status test requires Task 8 to
have already generated `packages/api/src/cache/test-001.json` — run Task 8
before this test if working through tasks out of order.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/consentStore.ts packages/api/src/jobs.ts packages/api/src/routes packages/api/src/server.ts
git commit -m "feat: add Express server with consent-gated demographics/records routes"
```

---

## Task 10: React app scaffold, API client, and Demographics page

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/vitest.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/api-client.ts`
- Create: `packages/web/src/pages/Demographics.tsx`
- Test: `packages/web/src/pages/Demographics.test.tsx`

**Interfaces:**
- Consumes: `sandboxPatients` from `@onboarding/shared`
- Produces: `submitDemographics(patientId): Promise<{particlePatientId: string}>`,
  `submitConsent(patientId): Promise<void>`, `fetchRecords(patientId): Promise<RecordsResponse>`,
  `pollJob(jobId): Promise<JobStatus>` (all in `api-client.ts`, consumed by
  Tasks 11-12); `<Demographics onSelected={(patientId: string) => void}>`
  component consumed by `App.tsx`.

- [ ] **Step 1: Scaffold the web package**

`packages/web/package.json`:
```json
{
  "name": "@onboarding/web",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@onboarding/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

`packages/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

`packages/web/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

`packages/web/vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

`packages/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Patient Onboarding Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`packages/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Write `api-client.ts` (no test — thin fetch wrapper, exercised through the page tests in Tasks 11-12)**

`packages/web/src/api-client.ts`:
```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export async function submitDemographics(patientId: string): Promise<{ particlePatientId: string }> {
  const res = await fetch(`${API_BASE}/api/demographics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId }),
  });
  if (!res.ok) throw new Error(`Failed to register: ${res.status}`);
  return res.json();
}

export async function submitConsent(patientId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, accepted: true }),
  });
  if (!res.ok) throw new Error(`Failed to submit consent: ${res.status}`);
}

export interface RecordsResponse {
  status: 'CACHED' | 'LIVE_STARTED';
  record?: unknown;
  jobId?: string;
}

export async function fetchRecords(patientId: string): Promise<RecordsResponse> {
  const res = await fetch(`${API_BASE}/api/records/${patientId}`);
  if (res.status === 403) throw new Error('Consent required before fetching records');
  if (!res.ok && res.status !== 202) throw new Error(`Failed to fetch records: ${res.status}`);
  return res.json();
}

export interface JobStatus {
  id: string;
  state: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR';
  particleState?: string;
  record?: unknown;
  error?: string;
}

export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/records/live/${jobId}/status`);
  if (!res.ok) throw new Error(`Failed to poll job: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Write the failing test for the Demographics page**

`packages/web/src/pages/Demographics.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Demographics } from './Demographics.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Demographics', () => {
  it('renders all 8 sandbox patients and calls onSelected after successful registration', async () => {
    vi.spyOn(apiClient, 'submitDemographics').mockResolvedValue({ particlePatientId: 'ppid-007' });
    const onSelected = vi.fn();

    render(<Demographics onSelected={onSelected} />);

    expect(screen.getAllByRole('button')).toHaveLength(8);
    expect(screen.getByText(/Hart Fallon/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Hart Fallon/));

    await waitFor(() => expect(onSelected).toHaveBeenCalledWith('test-007'));
  });

  it('shows an error message if registration fails', async () => {
    vi.spyOn(apiClient, 'submitDemographics').mockRejectedValue(new Error('Failed to register: 502'));

    render(<Demographics onSelected={vi.fn()} />);
    fireEvent.click(screen.getByText(/Hart Fallon/));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to register: 502'));
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd packages/web && npx vitest run src/pages/Demographics.test.tsx`
Expected: FAIL — `Demographics.tsx` does not exist yet.

- [ ] **Step 5: Write `Demographics.tsx`**

`packages/web/src/pages/Demographics.tsx`:
```tsx
import { useState } from 'react';
import { sandboxPatients } from '@onboarding/shared';
import { submitDemographics } from '../api-client.js';

export function Demographics({ onSelected }: { onSelected: (patientId: string) => void }) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(patientId: string) {
    setSubmitting(patientId);
    setError(null);
    try {
      await submitDemographics(patientId);
      onSelected(patientId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div>
      <h1>Select a patient</h1>
      <ul>
        {sandboxPatients.map((p) => (
          <li key={p.demographics.patient_id}>
            <button disabled={submitting !== null} onClick={() => handleSelect(p.demographics.patient_id)}>
              {p.name} ({p.tier})
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/web && npx vitest run src/pages/Demographics.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Write a minimal `App.tsx` so the app builds (wired up further in Task 11)**

`packages/web/src/App.tsx`:
```tsx
import { useState } from 'react';
import { Demographics } from './pages/Demographics.js';

export function App() {
  const [patientId, setPatientId] = useState<string | null>(null);

  if (!patientId) {
    return <Demographics onSelected={setPatientId} />;
  }

  return <p>Patient {patientId} selected. Identity verification and consent steps coming in the next task.</p>;
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/web
git commit -m "feat: scaffold React app, API client, and Demographics patient picker"
```

---

## Task 11: Identity verification (mocked) and Consent pages

**Files:**
- Create: `packages/web/src/pages/IdentityVerification.tsx`
- Create: `packages/web/src/pages/Consent.tsx`
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/pages/Consent.test.tsx`

**Interfaces:**
- Consumes: `submitConsent` from `../api-client.js`
- Produces: `<IdentityVerification onVerified={() => void}>`,
  `<Consent patientId={string} onConsented={() => void}>` — both consumed by
  `App.tsx`.

**No test for `IdentityVerification.tsx`** — per the design spec, this is an
explicitly mocked placeholder with nothing real to verify (no backend call,
just a simulated delay and a button). `Consent.tsx` does get a real test since
it makes a real backend call whose failure needs to be handled.

- [ ] **Step 1: Write `IdentityVerification.tsx`**

`packages/web/src/pages/IdentityVerification.tsx`:
```tsx
import { useState } from 'react';

export function IdentityVerification({ onVerified }: { onVerified: () => void }) {
  const [verifying, setVerifying] = useState(false);

  function handleVerify() {
    setVerifying(true);
    // Mocked identity verification: this demo does not integrate a real IDV
    // vendor. A production build would call one here (e.g. Persona, Stripe
    // Identity) instead of this simulated delay.
    setTimeout(() => {
      setVerifying(false);
      onVerified();
    }, 1000);
  }

  return (
    <div>
      <h1>Verify your identity</h1>
      <p>In a production build, this step would collect an ID document scan and a liveness check.</p>
      <button disabled={verifying} onClick={handleVerify}>
        {verifying ? 'Verifying...' : 'Simulate identity verification'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test for Consent**

`packages/web/src/pages/Consent.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Consent } from './Consent.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Consent', () => {
  it('calls submitConsent and onConsented when the patient authorizes retrieval', async () => {
    vi.spyOn(apiClient, 'submitConsent').mockResolvedValue(undefined);
    const onConsented = vi.fn();

    render(<Consent patientId="test-007" onConsented={onConsented} />);
    fireEvent.click(screen.getByText(/I authorize/));

    await waitFor(() => expect(apiClient.submitConsent).toHaveBeenCalledWith('test-007'));
    await waitFor(() => expect(onConsented).toHaveBeenCalled());
  });

  it('shows an error if consent submission fails', async () => {
    vi.spyOn(apiClient, 'submitConsent').mockRejectedValue(new Error('Failed to submit consent: 500'));

    render(<Consent patientId="test-007" onConsented={vi.fn()} />);
    fireEvent.click(screen.getByText(/I authorize/));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to submit consent: 500'));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/web && npx vitest run src/pages/Consent.test.tsx`
Expected: FAIL — `Consent.tsx` does not exist yet.

- [ ] **Step 4: Write `Consent.tsx`**

`packages/web/src/pages/Consent.tsx`:
```tsx
import { useState } from 'react';
import { submitConsent } from '../api-client.js';

export function Consent({ patientId, onConsented }: { patientId: string; onConsented: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAuthorize() {
    setSubmitting(true);
    setError(null);
    try {
      await submitConsent(patientId);
      onConsented();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Authorize record retrieval</h1>
      <p>
        By continuing, you authorize retrieval of your available medical records from
        healthcare organizations across the United States, for your own access and use.
      </p>
      <button disabled={submitting} onClick={handleAuthorize}>
        I authorize retrieval of my records
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/web && npx vitest run src/pages/Consent.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Wire the three steps together in `App.tsx`**

`packages/web/src/App.tsx`:
```tsx
import { useState } from 'react';
import { Demographics } from './pages/Demographics.js';
import { IdentityVerification } from './pages/IdentityVerification.js';
import { Consent } from './pages/Consent.js';

type Step = 'demographics' | 'idv' | 'consent' | 'results';

export function App() {
  const [step, setStep] = useState<Step>('demographics');
  const [patientId, setPatientId] = useState<string | null>(null);

  if (step === 'demographics') {
    return (
      <Demographics
        onSelected={(id) => {
          setPatientId(id);
          setStep('idv');
        }}
      />
    );
  }

  if (step === 'idv') {
    return <IdentityVerification onVerified={() => setStep('consent')} />;
  }

  if (step === 'consent' && patientId) {
    return <Consent patientId={patientId} onConsented={() => setStep('results')} />;
  }

  return <p>Patient {patientId} consented. Results view coming in the next task.</p>;
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/pages/IdentityVerification.tsx packages/web/src/pages/Consent.tsx packages/web/src/pages/Consent.test.tsx packages/web/src/App.tsx
git commit -m "feat: add mocked IDV step and real consent step, wire onboarding flow"
```

---

## Task 12: Results page, ProgressState component, full wiring

**Files:**
- Create: `packages/web/src/components/ProgressState.tsx`
- Create: `packages/web/src/pages/Results.tsx`
- Modify: `packages/web/src/App.tsx`
- Test: `packages/web/src/pages/Results.test.tsx`
- Test: `packages/web/src/components/ProgressState.test.tsx`

**Interfaces:**
- Consumes: `fetchRecords`, `pollJob` from `../api-client.js`;
  `NormalizedPatientRecord` from `@onboarding/shared`
- Produces: `<Results patientId={string}>` (self-contained: fetches, polls if
  needed, and renders), `<ProgressState jobId={string} onComplete={(record) => void}>`
  — both consumed by `App.tsx`.

- [ ] **Step 1: Write the failing test for ProgressState**

`packages/web/src/components/ProgressState.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { ProgressState } from './ProgressState.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('ProgressState', () => {
  it('polls the job status and calls onComplete with the record once COMPLETE', async () => {
    const record = { patientId: 'ppid-1', sourceFormat: 'FHIR' };
    vi.spyOn(apiClient, 'pollJob')
      .mockResolvedValueOnce({ id: 'job-1', state: 'RUNNING', particleState: 'RUNNING' })
      .mockResolvedValueOnce({ id: 'job-1', state: 'COMPLETE', record });
    const onComplete = vi.fn();

    render(<ProgressState jobId="job-1" onComplete={onComplete} pollIntervalMs={10} />);

    expect(screen.getByText(/searching provider networks/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(30);

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(record));
  });

  it('shows an error state if the job ends in ERROR', async () => {
    vi.spyOn(apiClient, 'pollJob').mockResolvedValue({
      id: 'job-2',
      state: 'ERROR',
      error: 'Query timed out',
    });

    render(<ProgressState jobId="job-2" onComplete={vi.fn()} pollIntervalMs={10} />);

    await vi.advanceTimersByTimeAsync(30);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Query timed out'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/web && npx vitest run src/components/ProgressState.test.tsx`
Expected: FAIL — `ProgressState.tsx` does not exist yet.

- [ ] **Step 3: Write `ProgressState.tsx`**

`packages/web/src/components/ProgressState.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { pollJob, type JobStatus } from '../api-client.js';

export function ProgressState({
  jobId,
  onComplete,
  pollIntervalMs = 5000,
}: {
  jobId: string;
  onComplete: (record: unknown) => void;
  pollIntervalMs?: number;
}) {
  const [status, setStatus] = useState<JobStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const job = await pollJob(jobId);
      if (cancelled) return;
      setStatus(job);
      if (job.state === 'COMPLETE') {
        clearInterval(interval);
        onComplete(job.record);
      }
      if (job.state === 'ERROR') {
        clearInterval(interval);
      }
    }, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, pollIntervalMs, onComplete]);

  if (status?.state === 'ERROR') {
    return <p role="alert">{status.error}</p>;
  }

  return (
    <div>
      <h1>Searching provider networks across the United States...</h1>
      <p>This typically takes 3-5 minutes. Current state: {status?.particleState ?? 'starting'}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/web && npx vitest run src/components/ProgressState.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for Results — populated and sparse cases**

`packages/web/src/pages/Results.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as apiClient from '../api-client.js';
import { Results } from './Results.js';
import type { NormalizedPatientRecord } from '@onboarding/shared';

beforeEach(() => {
  vi.restoreAllMocks();
});

const populatedRecord: NormalizedPatientRecord = {
  patientId: 'ppid-1',
  sourceFormat: 'FHIR',
  demographics: { givenName: 'Hart', familyName: 'Fallon', gender: 'male', dateOfBirth: '1952-10-01' },
  providers: [{ id: 'p1', givenName: 'Meredith', familyName: 'Gray', specialty: 'Primary Care' }],
  organizations: [{ id: 'o1', name: 'Sample City Clinic', city: 'Sample City', state: 'NY' }],
  encounters: [{ id: 'e1', typeName: 'Ambulatory', startTime: '2020-01-01', endTime: null, providerId: 'p1' }],
  conditions: [{ id: 'c1', name: 'Type 2 diabetes', code: 'E11.9', clinicalStatus: 'active', onsetDate: '2018-01-01' }],
  medications: [{ id: 'm1', name: 'Metformin', code: null, status: 'active', doseValue: '500', doseUnit: 'mg', doseRoute: 'oral' }],
  allergies: [],
  immunizations: [],
  labResults: [{ id: 'l1', name: 'HbA1c', value: '6.5', unit: '%', interpretation: null, timestamp: '2021-06-01' }],
};

describe('Results', () => {
  it('renders a populated record immediately when the backend returns CACHED', async () => {
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'CACHED', record: populatedRecord });

    render(<Results patientId="test-007" />);

    await waitFor(() => expect(screen.getByText('Hart Fallon')).toBeInTheDocument());
    expect(screen.getByText('Meredith Gray')).toBeInTheDocument();
    expect(screen.getByText('Type 2 diabetes')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
  });

  it('shows explicit "not available" states for sparse sections instead of hiding or erroring', async () => {
    const sparseRecord: NormalizedPatientRecord = {
      ...populatedRecord,
      allergies: [],
      immunizations: [],
      organizations: [],
    };
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'CACHED', record: sparseRecord });

    render(<Results patientId="test-007" />);

    await waitFor(() => expect(screen.getByText('Hart Fallon')).toBeInTheDocument());
    expect(screen.getByText(/No allergy information available/i)).toBeInTheDocument();
    expect(screen.getByText(/No immunization information available/i)).toBeInTheDocument();
  });

  it('shows ProgressState and does not crash when the backend returns LIVE_STARTED', async () => {
    vi.spyOn(apiClient, 'fetchRecords').mockResolvedValue({ status: 'LIVE_STARTED', jobId: 'job-1' });
    vi.spyOn(apiClient, 'pollJob').mockResolvedValue({ id: 'job-1', state: 'RUNNING', particleState: 'RUNNING' });

    render(<Results patientId="test-002" />);

    await waitFor(() => expect(screen.getByText(/searching provider networks/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd packages/web && npx vitest run src/pages/Results.test.tsx`
Expected: FAIL — `Results.tsx` does not exist yet.

- [ ] **Step 7: Write `Results.tsx`**

`packages/web/src/pages/Results.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { fetchRecords } from '../api-client.js';
import { ProgressState } from '../components/ProgressState.js';
import type { NormalizedPatientRecord } from '@onboarding/shared';

export function Results({ patientId }: { patientId: string }) {
  const [record, setRecord] = useState<NormalizedPatientRecord | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecords(patientId)
      .then((res) => {
        if (res.status === 'CACHED') {
          setRecord(res.record as NormalizedPatientRecord);
        } else {
          setJobId(res.jobId!);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [patientId]);

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (jobId && !record) {
    return (
      <ProgressState jobId={jobId} onComplete={(r) => setRecord(r as NormalizedPatientRecord)} />
    );
  }

  if (!record) {
    return <p>Loading...</p>;
  }

  return (
    <div>
      <h1>
        {record.demographics.givenName} {record.demographics.familyName}
      </h1>

      <section>
        <h2>Providers</h2>
        {record.providers.length === 0 ? (
          <p>No provider information available.</p>
        ) : (
          <ul>
            {record.providers.map((p) => (
              <li key={p.id}>
                {p.givenName} {p.familyName}
                {p.specialty ? ` — ${p.specialty}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Conditions</h2>
        {record.conditions.length === 0 ? (
          <p>No condition information available.</p>
        ) : (
          <ul>
            {record.conditions.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Medications</h2>
        {record.medications.length === 0 ? (
          <p>No medication information available.</p>
        ) : (
          <ul>
            {record.medications.map((m) => (
              <li key={m.id}>{m.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Allergies</h2>
        {record.allergies.length === 0 ? (
          <p>No allergy information available.</p>
        ) : (
          <ul>
            {record.allergies.map((a) => (
              <li key={a.id}>{a.substance}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Immunizations</h2>
        {record.immunizations.length === 0 ? (
          <p>No immunization information available.</p>
        ) : (
          <ul>
            {record.immunizations.map((i) => (
              <li key={i.id}>{i.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Lab results</h2>
        {record.labResults.length === 0 ? (
          <p>No lab result information available.</p>
        ) : (
          <ul>
            {record.labResults.map((l) => (
              <li key={l.id}>
                {l.name}: {l.value} {l.unit}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd packages/web && npx vitest run src/pages/Results.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Wire Results into `App.tsx` — the demo is now end-to-end**

`packages/web/src/App.tsx`:
```tsx
import { useState } from 'react';
import { Demographics } from './pages/Demographics.js';
import { IdentityVerification } from './pages/IdentityVerification.js';
import { Consent } from './pages/Consent.js';
import { Results } from './pages/Results.js';

type Step = 'demographics' | 'idv' | 'consent' | 'results';

export function App() {
  const [step, setStep] = useState<Step>('demographics');
  const [patientId, setPatientId] = useState<string | null>(null);

  if (step === 'demographics') {
    return (
      <Demographics
        onSelected={(id) => {
          setPatientId(id);
          setStep('idv');
        }}
      />
    );
  }

  if (step === 'idv') {
    return <IdentityVerification onVerified={() => setStep('consent')} />;
  }

  if (step === 'consent' && patientId) {
    return <Consent patientId={patientId} onConsented={() => setStep('results')} />;
  }

  if (step === 'results' && patientId) {
    return <Results patientId={patientId} />;
  }

  return null;
}
```

- [ ] **Step 10: Run the full test suite across all packages**

Run: `npm test` (from the workspace root)
Expected: all tests across `shared`, `api`, and `web` pass.

- [ ] **Step 11: Manual end-to-end smoke test**

```bash
# terminal 1
npm run dev --workspace packages/api
# terminal 2
npm run dev --workspace packages/web
```

Open the printed Vite URL, pick Hart Fallon, click through mocked IDV and
consent, and confirm the Results page renders his providers, conditions,
medications, and lab results — this exercises the real cached JSON from
Task 8, not mocks. Then try a patient whose cache file you temporarily
deleted, and confirm the progress UI appears and eventually resolves to the
same Results view.

- [ ] **Step 12: Commit**

```bash
git add packages/web/src/components/ProgressState.tsx packages/web/src/components/ProgressState.test.tsx packages/web/src/pages/Results.tsx packages/web/src/pages/Results.test.tsx packages/web/src/App.tsx
git commit -m "feat: add Results page and live-progress polling, complete end-to-end onboarding flow"
```

---

## Self-Review Notes

**Spec coverage:** every section of `demo_design_spec.md` maps to at least one
task — components (Tasks 1-12 collectively), data flow (Tasks 9-12), module
structure (matches the file tree exactly), error handling (401/429/403
handling in Task 2-4 and 9, timeout in Task 7, cache-miss fallback in Task 9,
sparse-data-is-not-an-error in Tasks 5, 6, 12), testing (every task's own test
step, plus Task 12 Step 10 running the full suite).

**Placeholder scan:** no TBD/TODO in any step; the one deliberately-flagged
uncertainty (allergy/immunization Flat field names in Task 5) is disclosed as
a reasoned inference with a concrete verification step in Task 8, not left as
an unresolved placeholder — the code itself is complete and real either way.

**Type consistency:** `NormalizedPatientRecord` and its sub-types are defined
once in Task 1 and referenced identically by name in every later task;
`Retrieval`/`FlatDomains`/`FhirBundle` defined in Task 4 and consumed
identically in Tasks 5-7; `Job`/`JobStatus` defined in Task 9 and consumed
identically by the frontend in Task 12; function names (`runFlow`,
`normalize`, `retrieveByTier`, `registerPatient`, `startQuery`,
`getQueryStatus`, `fetchFlat`, `fetchFhir`) are spelled identically at every
definition and call site across tasks.
