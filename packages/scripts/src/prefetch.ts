import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../../.env') });

// Note: ES module imports are hoisted and linked before any top-level statement
// runs, so the static imports below are actually loaded before config() executes
// above, not after. This is safe today only because @onboarding/api's client.ts
// reads PARTICLE_CLIENT_ID/PARTICLE_CLIENT_SECRET lazily inside getAccessToken(),
// not at module scope. If that ever changes to a module-level read, switch these
// to dynamic import() calls after config() to preserve real load-order.
import { writeFileSync, mkdirSync } from 'node:fs';
import { sandboxPatients } from '@onboarding/shared';
import { runFlow } from '@onboarding/api';

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
