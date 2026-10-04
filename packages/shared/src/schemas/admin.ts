import { z } from 'zod';
import '../zod-locale.js';
import { SLOT_DURATIONS, TIME_OPTIONS } from '../constants.js';
import { DisplayStatus } from '../enums.js';
import { timeToMinutes } from '../helpers/time.js';
import { dateStringSchema, monthStringSchema } from './availability.js';

export const ADMIN_PAGE_SIZE_DEFAULT = 20;
export const ADMIN_PAGE_SIZE_MAX = 100;
export const BLOCK_DATES_MAX = 92;
export const INVALID_PERIOD_MESSAGE = 'A data inicial deve ser anterior ou igual à data final.';

export const adminCalendarQuerySchema = z.object({ month: monthStringSchema });
export type AdminCalendarQuery = z.output<typeof adminCalendarQuerySchema>;

/** Query of GET /admin/appointments. `from` defaults to today in the service (needs the clock). */
export const adminAppointmentsQuerySchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    status: z
      .enum([DisplayStatus.CONFIRMED, DisplayStatus.COMPLETED, DisplayStatus.CANCELLED], {
        error: 'Status inválido (use CONFIRMED, COMPLETED ou CANCELLED).',
      })
      .optional(),
    search: z
      .string()
      .trim()
      .max(100, { error: 'A busca deve ter no máximo 100 caracteres.' })
      .transform((value) => (value === '' ? undefined : value))
      .optional(),
    page: z.coerce
      .number({ error: 'Página inválida.' })
      .int({ error: 'Página inválida.' })
      .min(1, { error: 'Página inválida.' })
      .default(1),
    pageSize: z.coerce
      .number({ error: 'Tamanho de página inválido.' })
      .int({ error: 'Tamanho de página inválido.' })
      .min(1, { error: 'Tamanho de página inválido.' })
      .max(ADMIN_PAGE_SIZE_MAX, {
        error: `O tamanho de página deve ser no máximo ${ADMIN_PAGE_SIZE_MAX}.`,
      })
      .default(ADMIN_PAGE_SIZE_DEFAULT),
  })
  // Only when both are sent: with `from` omitted, the service checks today <= `to`.
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: INVALID_PERIOD_MESSAGE,
    path: ['to'],
  });
export type AdminAppointmentsQuery = z.output<typeof adminAppointmentsQuerySchema>;

const timeOptionSchema = z
  .string({ error: 'Informe o horário.' })
  .refine((time) => TIME_OPTIONS.includes(time), {
    error: 'Horário inválido (use HH:mm em horas cheias ou meias-horas).',
  });

const workingHoursSchema = z
  .object({
    weekday: z
      .number({ error: 'Dia da semana inválido.' })
      .int({ error: 'Dia da semana inválido.' })
      .min(0, { error: 'Dia da semana inválido.' })
      .max(6, { error: 'Dia da semana inválido.' }),
    isActive: z.boolean({ error: 'Informe se o dia está ativo.' }),
    startTime: timeOptionSchema,
    endTime: timeOptionSchema,
  })
  // Checked for inactive days too: their times are kept for reactivation (RN-03).
  .refine(
    (row) =>
      !TIME_OPTIONS.includes(row.startTime) ||
      !TIME_OPTIONS.includes(row.endTime) ||
      timeToMinutes(row.endTime) > timeToMinutes(row.startTime),
    { error: 'O horário de fim deve ser depois do início.', path: ['endTime'] },
  );

/** Body of PUT /admin/schedule (RN-02, RN-03): duration + one row per weekday (0-6). */
export const scheduleConfigSchema = z.object({
  slotDurationMinutes: z
    .number({ error: 'Informe a duração do slot.' })
    .refine((value) => (SLOT_DURATIONS as readonly number[]).includes(value), {
      error: `A duração deve ser ${SLOT_DURATIONS.join(' ou ')} minutos.`,
    }),
  workingHours: z
    .array(workingHoursSchema, { error: 'Informe o horário semanal.' })
    .length(7, { error: 'Informe os 7 dias da semana.' })
    .refine((rows) => new Set(rows.map((row) => row.weekday)).size === rows.length, {
      error: 'Cada dia da semana deve aparecer uma única vez.',
    })
    .transform((rows) => [...rows].sort((a, b) => a.weekday - b.weekday)),
});
export type ScheduleConfigInput = z.input<typeof scheduleConfigSchema>;
export type ScheduleConfigData = z.output<typeof scheduleConfigSchema>;

/** Body of POST /admin/blocked-dates and /unblock: 1-92 dates, deduplicated and sorted. */
export const blockDatesSchema = z.object({
  dates: z
    .array(dateStringSchema, { error: 'Informe as datas.' })
    .min(1, { error: 'Informe ao menos uma data.' })
    .max(BLOCK_DATES_MAX, { error: `Informe no máximo ${BLOCK_DATES_MAX} datas.` })
    .transform((dates) => [...new Set(dates)].sort()),
});
export type BlockDatesInput = z.input<typeof blockDatesSchema>;
export type BlockDatesData = z.output<typeof blockDatesSchema>;
