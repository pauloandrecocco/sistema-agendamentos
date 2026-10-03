import { DayAvailabilityStatus } from '@agenda/shared';
import type { DayState } from '@/components/MonthCalendar';

const DAY_STATES: Record<DayAvailabilityStatus, DayState> = {
  AVAILABLE: { disabled: false, tone: 'available', label: 'Com horários disponíveis' },
  NO_SLOTS: { disabled: true, tone: 'unavailable', label: 'Sem vagas' },
  CLOSED: { disabled: true, tone: 'unavailable', label: 'Fechado' },
  BLOCKED: { disabled: true, tone: 'blocked', label: 'Bloqueado' },
  PAST: { disabled: true, tone: 'muted', label: 'Data passada' },
};

/** RF-02: only AVAILABLE days can be clicked. A day missing from the response is not clickable. */
export function getAvailabilityDayState(status: DayAvailabilityStatus | undefined): DayState {
  return status ? DAY_STATES[status] : DAY_STATES[DayAvailabilityStatus.CLOSED];
}

/** Legend under the booking calendar, in display order. */
export const DAY_STATE_LEGEND = [
  DayAvailabilityStatus.AVAILABLE,
  DayAvailabilityStatus.NO_SLOTS,
  DayAvailabilityStatus.CLOSED,
  DayAvailabilityStatus.BLOCKED,
].map((status) => ({ status, ...DAY_STATES[status] }));
