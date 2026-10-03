import { z } from 'zod';
import { isValidDateString, isValidMonthString } from '../helpers/business-date.js';

export const dateStringSchema = z
  .string({ error: 'Informe a data.' })
  .refine(isValidDateString, { error: 'Data inválida (use AAAA-MM-DD).' });

export const monthStringSchema = z
  .string({ error: 'Informe o mês.' })
  .refine(isValidMonthString, { error: 'Mês inválido (use AAAA-MM).' });

export const availabilityCalendarQuerySchema = z.object({ month: monthStringSchema });
export type AvailabilityCalendarQuery = z.output<typeof availabilityCalendarQuerySchema>;

export const availabilityDayQuerySchema = z.object({ date: dateStringSchema });
export type AvailabilityDayQuery = z.output<typeof availabilityDayQuerySchema>;
