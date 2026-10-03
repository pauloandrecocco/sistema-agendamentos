import type { AdminAppointmentsQuery, AppointmentScope } from '@agenda/shared';

/** Query of GET /admin/appointments as sent by the screens (page/pageSize always set). */
export type AdminAppointmentsParams = Partial<AdminAppointmentsQuery> &
  Pick<AdminAppointmentsQuery, 'page' | 'pageSize'>;

/**
 * Query keys of the app. Each group starts with a shared prefix so a mutation can invalidate
 * everything it affects at once (e.g. `queryKeys.availability.all` = calendar + day slots).
 */
export const queryKeys = {
  availability: {
    all: ['availability'] as const,
    calendar: (month: string) => ['availability', 'calendar', month] as const,
    day: (date: string) => ['availability', 'day', date] as const,
  },
  myAppointments: {
    all: ['appointments', 'me'] as const,
    list: (scope: AppointmentScope) => ['appointments', 'me', scope] as const,
  },
  /** Admin panel data that changes with cancellations, blocks and schedule changes. */
  admin: {
    all: ['admin'] as const,
    summary: ['admin', 'summary'] as const,
    calendar: (month: string) => ['admin', 'calendar', month] as const,
    appointments: (params: AdminAppointmentsParams) => ['admin', 'appointments', params] as const,
  },
  /** Kept apart from `admin` so invalidating the panel does not refetch the settings form. */
  schedule: ['schedule'] as const,
};
