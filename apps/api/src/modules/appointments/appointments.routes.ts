import {
  Role,
  appointmentIdParamsSchema,
  createAppointmentSchema,
  myAppointmentsQuerySchema,
} from '@agenda/shared';
import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../middlewares/require-role.js';
import { validate } from '../../middlewares/validate.js';
import type { AppointmentsController } from './appointments.controller.js';

/** Client-only routes: admins get 403 (they do not book, PRD section 3). */
export function createAppointmentsRouter(
  controller: AppointmentsController,
  authenticate: RequestHandler,
) {
  const router = Router();
  const client = [authenticate, requireRole(Role.CLIENT)];
  router.post('/', ...client, validate({ body: createAppointmentSchema }), controller.create);
  router.get('/me', ...client, validate({ query: myAppointmentsQuerySchema }), controller.listMine);
  router.post(
    '/:id/cancel',
    ...client,
    validate({ params: appointmentIdParamsSchema }),
    controller.cancel,
  );
  return router;
}
