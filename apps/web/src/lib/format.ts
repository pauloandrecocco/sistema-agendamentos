import { BUSINESS_TIMEZONE, businessDateTimeToInstant, toBusinessDate } from '@agenda/shared';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Display formatting, always in the business timezone with the pt-BR locale. Calendar dates
 * ("YYYY-MM-DD") and instants (ISO UTC strings) have separate functions: parsing "2026-10-05" as
 * an instant would give UTC midnight, which is the previous day in São Paulo.
 */

function instantInBusinessTz(iso: string): TZDate {
  return new TZDate(new Date(iso).getTime(), BUSINESS_TIMEZONE);
}

function dateInBusinessTz(date: string): TZDate {
  return new TZDate(businessDateTimeToInstant(date, '00:00').getTime(), BUSINESS_TIMEZONE);
}

/** "2026-10-05T17:00:00.000Z" → "14:00" */
export function formatTime(iso: string): string {
  return format(instantInBusinessTz(iso), 'HH:mm');
}

/** "2026-10-05T17:00:00.000Z" → "05/10/2026" */
export function formatInstantDate(iso: string): string {
  return format(instantInBusinessTz(iso), 'dd/MM/yyyy');
}

/** "2026-10-05T17:00:00.000Z" → "segunda-feira, 05/10/2026" */
export function formatInstantWeekdayDate(iso: string): string {
  return format(instantInBusinessTz(iso), 'EEEE, dd/MM/yyyy', { locale: ptBR });
}

/** "2026-10-05" → "05/10/2026" */
export function formatDate(date: string): string {
  return format(dateInBusinessTz(date), 'dd/MM/yyyy');
}

/** "2026-10-05" → "segunda-feira, 5 de outubro de 2026" */
export function formatLongDate(date: string): string {
  return format(dateInBusinessTz(date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/** "2026-10" → "outubro de 2026" */
export function formatMonthLabel(month: string): string {
  return format(dateInBusinessTz(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

/** Today's calendar date in the business timezone. */
export function getBusinessToday(now: Date = new Date()): string {
  return toBusinessDate(now);
}

/** Stored digits → "(11) 98765-4321" / "(11) 3456-7890"; anything else is returned as is. */
export function formatPhone(digits: string): string {
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}
