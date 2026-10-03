import type { AdminCalendarDay, BlockDatesResponse, UnblockDatesResponse } from '@agenda/shared';
import { formatInstantDate, formatTime } from '@/lib/format';
import { pluralize } from './admin-day-state';

export type SelectionSummary = {
  /** Selected days that are not blocked yet. */
  toBlock: string[];
  /** Selected days that are blocked. */
  toUnblock: string[];
  /**
   * Confirmed appointments on `toBlock`, from the calendar counts. An estimate: appointments
   * that already started today are counted but stay (RN-11); the API returns the real list.
   */
  estimatedCancellations: number;
};

export function summarizeSelection(
  selected: Iterable<string>,
  getDay: (date: string) => AdminCalendarDay | undefined,
): SelectionSummary {
  const summary: SelectionSummary = { toBlock: [], toUnblock: [], estimatedCancellations: 0 };
  for (const date of [...selected].sort()) {
    const day = getDay(date);
    if (day?.isBlocked) {
      summary.toUnblock.push(date);
    } else {
      summary.toBlock.push(date);
      summary.estimatedCancellations += day?.appointmentsCount ?? 0;
    }
  }
  return summary;
}

const LISTED_CANCELLATIONS = 5;

/** Final message of a block, from the API response (the real cancelled list, RN-11). */
export function buildBlockResultMessage({
  blockedDates,
  cancelledAppointments,
}: BlockDatesResponse): string {
  const blocked = `${pluralize(blockedDates.length, 'dia bloqueado', 'dias bloqueados')}.`;
  if (cancelledAppointments.length === 0) return `${blocked} Nenhum agendamento cancelado.`;

  const listed = cancelledAppointments
    .slice(0, LISTED_CANCELLATIONS)
    .map(({ startAt }) => `${formatInstantDate(startAt)} às ${formatTime(startAt)}`);
  const rest = cancelledAppointments.length - listed.length;
  const cancelled = pluralize(
    cancelledAppointments.length,
    'agendamento cancelado',
    'agendamentos cancelados',
  );
  return `${blocked} ${cancelled}: ${listed.join(', ')}${rest > 0 ? ` e mais ${rest}` : ''}.`;
}

export function buildUnblockResultMessage({ unblockedDates }: UnblockDatesResponse): string {
  return `${pluralize(unblockedDates.length, 'dia desbloqueado', 'dias desbloqueados')}.`;
}
