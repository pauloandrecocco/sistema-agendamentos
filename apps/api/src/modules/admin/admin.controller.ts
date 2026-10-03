import type {
  AdminAppointmentListResponse,
  AdminAppointmentsQuery,
  AdminCalendarQuery,
  AdminCalendarResponse,
  AdminSummaryResponse,
  AppointmentIdParams,
  AppointmentResponse,
} from '@agenda/shared';
import type { Request, Response } from 'express';
import { UnauthenticatedError } from '../../lib/errors.js';
import type { AppointmentsService } from '../appointments/appointments.service.js';
import type { AdminService } from './admin.service.js';

export function createAdminController(deps: {
  adminService: AdminService;
  appointmentsService: AppointmentsService;
}) {
  const { adminService, appointmentsService } = deps;
  return {
    summary: async (_req: Request, res: Response) => {
      res.json((await adminService.getSummary()) satisfies AdminSummaryResponse);
    },

    calendar: async (req: Request, res: Response) => {
      const { month } = req.query as AdminCalendarQuery;
      res.json((await adminService.getCalendar(month)) satisfies AdminCalendarResponse);
    },

    listAppointments: async (req: Request, res: Response) => {
      const query = req.query as unknown as AdminAppointmentsQuery;
      res.json((await adminService.listAppointments(query)) satisfies AdminAppointmentListResponse);
    },

    /** RF-10: same service and rules as the client cancellation (RN-08); cancelledBy = ADMIN. */
    cancelAppointment: async (req: Request, res: Response) => {
      if (!req.auth) throw new UnauthenticatedError();
      const { id } = req.params as AppointmentIdParams;
      const appointment = await appointmentsService.cancel(id, req.auth);
      res.json({ appointment } satisfies AppointmentResponse);
    },
  };
}

export type AdminController = ReturnType<typeof createAdminController>;
