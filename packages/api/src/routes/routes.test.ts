import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { NormalizedPatientRecord } from '@onboarding/shared';
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
  // Amendment (controller ruling): the brief's original version of this test
  // depended on a real cache file at src/cache/test-001.json produced by
  // Task 8's prefetch script running against live Particle sandbox
  // credentials. Those credentials aren't available yet, so src/cache/ is
  // currently empty in this environment. Rather than depend on that external
  // prerequisite, this test writes its own fixture cache file directly and
  // cleans it up afterward.
  //
  // Fix (post-review): the fixture originally used 'test-001' — Elvira's
  // real patient_id from sandbox-patients.ts. fetch-cached.ts's CACHED path
  // only keys off the :patientId route param and never checks it against
  // sandboxPatients, so any id that passes the consent check works equally
  // well here. Using a real patient_id meant that once the user gets real
  // Particle credentials and runs the Task 8 prefetch script for real, this
  // test would overwrite the genuine cached record in beforeEach and then
  // permanently delete it in afterEach on every test run — a forward-looking
  // data-loss bug. Using an id that can never collide with a real
  // sandboxPatients entry (none of which match this pattern) sidesteps the
  // problem entirely instead of requiring stash/restore logic.
  const CACHE_DIR = join(process.cwd(), 'src/cache');
  const FIXTURE_PATIENT_ID = 'test-fixture-only-not-a-real-sandbox-patient';
  const fixturePath = join(CACHE_DIR, `${FIXTURE_PATIENT_ID}.json`);
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
    writeFileSync(fixturePath, JSON.stringify(fixtureRecord), 'utf-8');
  });

  afterEach(() => {
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

  it('returns 404 for an unknown patient_id even with consent granted', async () => {
    // Fixed from the brief: the brief's version of this test granted consent
    // for 'test-002' while querying 'test-999-uncached' — two different
    // patientIds — so it always failed with 403 (consent-gating fires before
    // the unknown-patient check) rather than exercising the 404 branch it
    // documents. Consent must be granted for the *same* id being queried for
    // this test to reach the patient-lookup code at all.
    await request(createServer())
      .post('/api/consent')
      .send({ patientId: 'test-999-uncached', accepted: true });
    vi.spyOn(flow, 'runFlow').mockImplementation(() => new Promise(() => {})); // never resolves in this test

    const res = await request(createServer()).get('/api/records/test-999-uncached');

    expect(res.status).toBe(404); // unknown patient_id takes precedence over the live-fetch fallback
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
