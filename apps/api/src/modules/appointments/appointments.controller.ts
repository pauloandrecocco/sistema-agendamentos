import type {
  AppointmentIdParams,
  AppointmentListResponse,
  AppointmentResponse,
  CreateAppointmentData,
  MyAppointmentsQuery,
} from '@agenda/shared';
import type { Request, Response } from 'express';
import { UnauthenticatedError } from '../../lib/errors.js';
import type { AuthContext } from '../../lib/jwt.js';
import type { AppointmentsService } from './appointments.service.js';

function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth;
}

export function createAppointmentsController(appointmentsService: AppointmentsService) {
  return {
    create: async (req: Request, res: Response) => {
      const { startAt } = req.body as CreateAppointmentData;
      const appointment = await appointmentsService.create(getAuth(req).userId, startAt);
      res.status(201).json({ appointment } satisfies AppointmentResponse);
    },

    listMine: async (req: Request, res: Response) => {
      const { scope } = req.query as MyAppointmentsQuery;
      const items = await appointmentsService.listMine(getAuth(req).userId, scope);
      res.json({ items } satisfies AppointmentListResponse);
    },

    cancel: async (req: Request, res: Response) => {
      const { id } = req.params as AppointmentIdParams;
      const appointment = await appointmentsService.cancel(id, getAuth(req));
      res.json({ appointment } satisfies AppointmentResponse);
    },
  };
}

export type AppointmentsController = ReturnType<typeof createAppointmentsController>;
