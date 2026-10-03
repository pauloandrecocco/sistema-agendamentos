import type { HealthResponse } from '@agenda/shared';
import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import type { TokenService } from './lib/jwt.js';
import { createAuthenticate } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';
import { requireJson } from './middlewares/require-json.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthService } from './modules/auth/auth.service.js';

export type AppDeps = {
  authService: AuthService;
  tokenService: TokenService;
  cookieSecure: boolean;
};

/** Builds the Express app from ready-made services (Prisma in server.ts, in-memory fakes in tests). */
export function createApp(deps: AppDeps) {
  const app = express();
  const authenticate = createAuthenticate(deps.tokenService);

  app.use(helmet());
  app.use(requireJson);
  app.use(express.json());
  app.use(cookieParser());

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' } satisfies HealthResponse);
  });
  api.use('/auth', createAuthRouter(createAuthController(deps), authenticate));

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
