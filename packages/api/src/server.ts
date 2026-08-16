import express from 'express';
import cors from 'cors';
import { demographicsRouter } from './routes/demographics.js';
import { consentRouter } from './routes/consent.js';
import { fetchCachedRouter } from './routes/fetch-cached.js';
import { fetchLiveRouter } from './routes/fetch-live.js';

export function createServer() {
  const app = express();
  // The frontend (Vite dev server, typically localhost:5173) and this API
  // (localhost:4000) run on different origins, so every fetch from
  // api-client.ts is cross-origin. cors() with its default (permissive)
  // settings answers the preflight OPTIONS requests that POST /api/demographics
  // and POST /api/consent trigger (both send Content-Type: application/json)
  // and adds Access-Control-Allow-Origin to every response — this is a demo
  // with no cookies/credentialed requests, so a restrictive origin allowlist
  // isn't needed.
  app.use(cors());
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
