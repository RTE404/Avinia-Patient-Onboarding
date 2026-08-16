import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { NormalizedPatientRecord } from '@onboarding/shared';
import * as patients from '../particle/patients.js';
import * as flow from '../flow.js';
import { grantConsent, resetConsentForTests } from '../consentStore.js';
import { createServer } from '../server.js';

beforeEach(() => {
  resetConsentForTests();
  vi.restoreAllMocks();
});

describe('POST /api/demographics', () => {
  it('accepts a known sandbox patient without registering it with Particle', async () => {
    // The endpoint's only real job is confirming the patient is one of the
    // fixed sandbox patients. It used to also call registerPatient, whose
    // particlePatientId no consumer ever used — and runFlow registers again
    // anyway, so every live-path patient was registered with Particle twice.
    const registerSpy = vi
      .spyOn(patients, 'registerPatient')
      .mockRejectedValue(new Error('registerPatient must not be called from POST /api/demographics'));

    const res = await request(createServer())
      .post('/api/demographics')
      .send({ patientId: 'test-007' });

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe('test-007');
    expect(registerSpy).not.toHaveBeenCalled();
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

describe('patientId validation (path-traversal hardening)', () => {
  it('rejects consent for a patientId that is not a known sandbox patient', async () => {
    const res = await request(createServer())
      .post('/api/consent')
      .send({ patientId: '../../package', accepted: true });

    expect(res.status).toBe(404);
  });

  it('never reads a file outside the cache directory, even if consent was somehow granted', async () => {
    // Defence in depth: bypass the consent route's own validation and force a
    // traversal-style id into the consent store directly, so this asserts the
    // record route's guard on its own rather than relying on the consent route.
    grantConsent('../../package');

    const res = await request(createServer()).get('/api/records/..%2F..%2Fpackage');

    expect(res.status).toBe(404);
    expect(res.body.record).toBeUndefined();
    // packages/api/package.json is what the unfixed version served here.
    expect(JSON.stringify(res.body)).not.toContain('@onboarding/api');
  });
});

describe('GET /api/records/live/:jobId/status', () => {
  async function startJob(patientId: string): Promise<string> {
    const app = createServer();
    await request(app).post('/api/consent').send({ patientId, accepted: true });
    vi.spyOn(flow, 'runFlow').mockImplementation(() => new Promise(() => {})); // never resolves
    const res = await request(app).post(`/api/records/${patientId}/live/start`);
    expect(res.status).toBe(202);
    return res.body.jobId as string;
  }

  it('returns the job for a patient whose consent is on file', async () => {
    const jobId = await startJob('test-002');

    const res = await request(createServer()).get(`/api/records/live/${jobId}/status`);

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('RUNNING');
  });

  it('returns 403 once consent for the job’s patient is no longer on file', async () => {
    // The status response carries the full NormalizedPatientRecord once the
    // job completes, so it has to be consent-gated exactly like the record
    // routes are — a bare jobId must not be enough to read someone's history.
    const jobId = await startJob('test-002');
    resetConsentForTests();

    const res = await request(createServer()).get(`/api/records/live/${jobId}/status`);

    expect(res.status).toBe(403);
    expect(res.body.record).toBeUndefined();
  });

  it('returns 404 for an unknown job id', async () => {
    const res = await request(createServer()).get('/api/records/live/no-such-job/status');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/records/:patientId', () => {
  // Amendment (controller ruling): the brief's original version of this test
  // depended on a real cache file at src/cache/test-001.json produced by
  // Task 8's prefetch script running against live Particle sandbox
  // credentials. Those credentials aren't available yet, so src/cache/ is
  // currently empty in this environment. Rather than depend on that external
  // prerequisite, this test writes its own fixture cache file directly and
  // cleans it up afterward.
  //
  // Fix (final review, finding 1): this fixture previously used a synthetic id
  // that is deliberately absent from sandboxPatients, to avoid clobbering a
  // real prefetched cache file. That is no longer possible — the route now
  // resolves :patientId against sandboxPatients *before* reading any file, so
  // an id that isn't a real sandbox patient 404s and never reaches the cache
  // at all. The fixture therefore has to use a genuine patient_id, and the
  // data-loss concern is handled by stashing and restoring any pre-existing
  // cache file around each test instead.
  // Same import.meta.url-relative resolution the route and the prefetch
  // script use, so this test can't accidentally pass by agreeing with a
  // cwd-based path the production code no longer uses.
  const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../cache');
  const FIXTURE_PATIENT_ID = 'test-001';
  const fixturePath = join(CACHE_DIR, `${FIXTURE_PATIENT_ID}.json`);
  let stashedCacheFile: string | null = null;
  const fixtureRecord: NormalizedPatientRecord = {
    patientId: 'ppid-fixture-001',
    sourceFormat: 'FHIR',
    demographics: {
      givenName: 'Fixture',
      familyName: 'Patient',
      gender: 'FEMALE',
      dateOfBirth: '1970-12-26',
    },
    providers: [],
    organizations: [],
    encounters: [],
    conditions: [],
    medications: [],
    allergies: [],
    immunizations: [],
    labResults: [],
  };

  beforeEach(() => {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    stashedCacheFile = existsSync(fixturePath) ? readFileSync(fixturePath, 'utf-8') : null;
    writeFileSync(fixturePath, JSON.stringify(fixtureRecord), 'utf-8');
  });

  afterEach(() => {
    if (stashedCacheFile !== null) {
      // Put a genuine prefetched record back exactly as it was.
      writeFileSync(fixturePath, stashedCacheFile, 'utf-8');
      stashedCacheFile = null;
      return;
    }
    try {
      unlinkSync(fixturePath);
    } catch {
      // already gone; nothing to clean up
    }
  });

  it('returns CACHED status and the record when a cache file exists', async () => {
    await request(createServer())
      .post('/api/consent')
      .send({ patientId: FIXTURE_PATIENT_ID, accepted: true });

    const res = await request(createServer()).get(`/api/records/${FIXTURE_PATIENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CACHED');
    expect(res.body.record).toEqual(fixtureRecord);
  });

  it('finds the cache file no matter what directory the process was started from', async () => {
    // The prefetch script writes the cache relative to its own file location,
    // so the API has to resolve it the same way. When the API resolved it
    // from process.cwd() instead, starting the server from anywhere but
    // packages/api made every cache lookup silently miss.
    const originalCwd = process.cwd();
    try {
      process.chdir(tmpdir());
      vi.resetModules();
      const [{ createServer: freshCreateServer }, { grantConsent: freshGrantConsent }] =
        await Promise.all([import('../server.js'), import('../consentStore.js')]);
      freshGrantConsent(FIXTURE_PATIENT_ID);

      const res = await request(freshCreateServer()).get(`/api/records/${FIXTURE_PATIENT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CACHED');
      expect(res.body.record).toEqual(fixtureRecord);
    } finally {
      process.chdir(originalCwd);
      vi.resetModules();
    }
  });

  it('returns 404 for an unknown patient_id', async () => {
    // The unknown-patient check now runs before the consent check (see
    // finding 1), so an id that isn't in sandboxPatients 404s whether or not
    // consent was ever granted — and consent can no longer be granted for one
    // anyway. This asserts the id never reaches the cache read or the
    // live-fetch fallback.
    const consentRes = await request(createServer())
      .post('/api/consent')
      .send({ patientId: 'test-999-uncached', accepted: true });
    expect(consentRes.status).toBe(404);
    const runFlowSpy = vi
      .spyOn(flow, 'runFlow')
      .mockImplementation(() => new Promise(() => {})); // never resolves in this test

    const res = await request(createServer()).get('/api/records/test-999-uncached');

    expect(res.status).toBe(404); // unknown patient_id takes precedence over the live-fetch fallback
    expect(runFlowSpy).not.toHaveBeenCalled();
  });

  it('falls back to starting a live flow and returns LIVE_STARTED for a known patient with no cache file', async () => {
    // test-002 is a real sandbox patient but has no fixture written for it
    // in this describe block (only test-001.json is written above), so this
    // exercises the genuine cache-miss path end to end.
    await request(createServer()).post('/api/consent').send({ patientId: 'test-002', accepted: true });
    vi.spyOn(flow, 'runFlow').mockImplementation(() => new Promise(() => {})); // never resolves in this test

    const res = await request(createServer()).get('/api/records/test-002');

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('LIVE_STARTED');
    expect(res.body.jobId).toEqual(expect.any(String));
  });
});
