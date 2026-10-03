import type { AppointmentScope } from '@agenda/shared';

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
};
