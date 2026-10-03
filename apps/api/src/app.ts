import type { HealthResponse } from '@agenda/shared';
import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import helmet from 'helmet';
import type { TokenService } from './lib/jwt.js';
import { createAuthenticate } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFoundHandler } from './middlewares/not-found.js';
import { requireJson } from './middlewares/require-json.js';
import { createAdminController } from './modules/admin/admin.controller.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import type { AdminService } from './modules/admin/admin.service.js';
import { createAppointmentsController } from './modules/appointments/appointments.controller.js';
import { createAppointmentsRouter } from './modules/appointments/appointments.routes.js';
import type { AppointmentsService } from './modules/appointments/appointments.service.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthService } from './modules/auth/auth.service.js';
import { createAvailabilityController } from './modules/availability/availability.controller.js';
import { createAvailabilityRouter } from './modules/availability/availability.routes.js';
import type { AvailabilityService } from './modules/availability/availability.service.js';
import { createScheduleController } from './modules/schedule/schedule.controller.js';
import type { ScheduleService } from './modules/schedule/schedule.service.js';

export type AppDeps = {
  adminService: AdminService;
  appointmentsService: AppointmentsService;
  authService: AuthService;
  availabilityService: AvailabilityService;
  scheduleService: ScheduleService;
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
  api.use(
    '/availability',
    createAvailabilityRouter(createAvailabilityController(deps.availabilityService)),
  );
  api.use(
    '/appointments',
    createAppointmentsRouter(createAppointmentsController(deps.appointmentsService), authenticate),
  );
  api.use(
    '/admin',
    createAdminRouter(
      {
        admin: createAdminController(deps),
        schedule: createScheduleController(deps.scheduleService),
      },
      authenticate,
    ),
  );

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
