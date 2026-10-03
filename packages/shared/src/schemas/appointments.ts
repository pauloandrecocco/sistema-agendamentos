import { z } from 'zod';

/** ISO 8601 instant, with "Z" or an offset (e.g. 2026-10-05T09:00:00-03:00); parsed to a Date. */
export const createAppointmentSchema = z.object({
  startAt: z
    .string({ error: 'Informe o horário.' })
    .pipe(z.iso.datetime({ offset: true, error: 'Horário inválido (use ISO 8601).' }))
    .transform((value) => new Date(value)),
});
export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
export type CreateAppointmentData = z.output<typeof createAppointmentSchema>;

export const AppointmentScope = { UPCOMING: 'upcoming', HISTORY: 'history' } as const;
export type AppointmentScope = (typeof AppointmentScope)[keyof typeof AppointmentScope];

export const myAppointmentsQuerySchema = z.object({
  scope: z
    .enum([AppointmentScope.UPCOMING, AppointmentScope.HISTORY], {
      error: 'Escopo inválido (use upcoming ou history).',
    })
    .default(AppointmentScope.UPCOMING),
});
export type MyAppointmentsQuery = z.output<typeof myAppointmentsQuerySchema>;

export const appointmentIdParamsSchema = z.object({
  id: z.uuid({ error: 'Identificador inválido.' }),
});
export type AppointmentIdParams = z.output<typeof appointmentIdParamsSchema>;
