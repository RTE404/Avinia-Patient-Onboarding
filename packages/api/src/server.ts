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
