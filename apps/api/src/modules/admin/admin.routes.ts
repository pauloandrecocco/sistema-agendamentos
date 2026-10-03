import {
  Role,
  adminAppointmentsQuerySchema,
  adminCalendarQuerySchema,
  appointmentIdParamsSchema,
  blockDatesSchema,
  scheduleConfigSchema,
} from '@agenda/shared';
import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../middlewares/require-role.js';
import { validate } from '../../middlewares/validate.js';
import type { ScheduleController } from '../schedule/schedule.controller.js';
import type { AdminController } from './admin.controller.js';

/**
 * Admin-only routes: clients get 403. Guards are per route (not router.use) so an unknown path
 * under /admin still falls through to the 404 handler.
 */
export function createAdminRouter(
  controllers: { admin: AdminController; schedule: ScheduleController },
  authenticate: RequestHandler,
) {
  const { admin, schedule } = controllers;
  const router = Router();
  const guard = [authenticate, requireRole(Role.ADMIN)];

  router.get('/summary', ...guard, admin.summary);
  router.get('/calendar', ...guard, validate({ query: adminCalendarQuerySchema }), admin.calendar);
  router.get(
    '/appointments',
    ...guard,
    validate({ query: adminAppointmentsQuerySchema }),
    admin.listAppointments,
  );
  router.post(
    '/appointments/:id/cancel',
    ...guard,
    validate({ params: appointmentIdParamsSchema }),
    admin.cancelAppointment,
  );

  router.get('/schedule', ...guard, schedule.getConfig);
  router.put(
    '/schedule',
    ...guard,
    validate({ body: scheduleConfigSchema }),
    schedule.updateConfig,
  );
  router.post('/blocked-dates', ...guard, validate({ body: blockDatesSchema }), schedule.block);
  router.post(
    '/blocked-dates/unblock',
    ...guard,
    validate({ body: blockDatesSchema }),
    schedule.unblock,
  );
  return router;
}
