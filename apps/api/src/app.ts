import type { HealthResponse } from '@agenda/shared';
import express, { Router } from 'express';
import helmet from 'helmet';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' } satisfies HealthResponse);
  });

  app.use('/api', api);

  return app;
}
