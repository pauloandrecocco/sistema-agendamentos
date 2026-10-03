import type { AdminCalendarDay } from '@agenda/shared';
import type { DayState } from '@/components/MonthCalendar';

/** "view": a click shows the day's appointments; "block": days are selected to (un)block. */
export type AgendaMode = 'view' | 'block';

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * RF-08: past, blocked and closed days look different. Any day can be opened to see its list
 * (past ones included, as history); past days cannot be (un)blocked (RN-11, RN-12).
 */
export function getAdminDayState(day: AdminCalendarDay | undefined, mode: AgendaMode): DayState {
  if (!day) return { disabled: true, tone: 'muted' };

  const label = [
    day.isPast && 'Data passada',
    day.isBlocked && 'Bloqueado',
    day.isClosed && 'Fechado',
    day.appointmentsCount > 0 && pluralize(day.appointmentsCount, 'agendamento', 'agendamentos'),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    disabled: mode === 'block' && day.isPast,
    tone: day.isPast ? 'muted' : day.isBlocked ? 'blocked' : day.isClosed ? 'closed' : 'default',
    ...(label && { label }),
  };
}
