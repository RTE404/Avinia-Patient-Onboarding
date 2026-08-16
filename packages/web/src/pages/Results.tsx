import { useEffect, useState } from 'react';
import { fetchRecords } from '../api-client.js';
import { ProgressState } from '../components/ProgressState.js';
import type { NormalizedPatientRecord } from '@onboarding/shared';

export function Results({ patientId }: { patientId: string }) {
  const [record, setRecord] = useState<NormalizedPatientRecord | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard against a stale response clobbering fresher state: React
    // StrictMode double-invokes effects in dev (mount, cleanup, re-mount),
    // and on a cache miss every GET starts a brand-new live query on the
    // backend, so an unguarded effect here would kick off two independent
    // queries per page visit and let whichever response happens to arrive
    // last win, even if it's the orphaned first one.
    let cancelled = false;
    fetchRecords(patientId)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'CACHED') {
          setRecord(res.record as NormalizedPatientRecord);
        } else {
          setJobId(res.jobId!);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
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
                <span>
                  {p.givenName} {p.familyName}
                </span>
                {p.specialty ? <span> — {p.specialty}</span> : null}
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
