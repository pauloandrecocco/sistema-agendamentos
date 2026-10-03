import { availabilityCalendarQuerySchema, availabilityDayQuerySchema } from '@agenda/shared';
import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import type { AvailabilityController } from './availability.controller.js';

/** Public routes: visitors can browse availability without logging in. */
export function createAvailabilityRouter(controller: AvailabilityController) {
  const router = Router();
  router.get(
    '/calendar',
    validate({ query: availabilityCalendarQuerySchema }),
    controller.calendar,
  );
  router.get('/', validate({ query: availabilityDayQuerySchema }), controller.day);
  return router;
}
