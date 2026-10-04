import type {
  AppointmentResponse,
  AvailabilityCalendarResponse,
  AvailabilityResponse,
} from '@agenda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useAvailabilityCalendar(month: string) {
  return useQuery({
    queryKey: queryKeys.availability.calendar(month),
    queryFn: () =>
      api.get<AvailabilityCalendarResponse>(
        `/availability/calendar?month=${encodeURIComponent(month)}`,
      ),
    refetchOnWindowFocus: true,
  });
}

export function useDayAvailability(date: string | null) {
  return useQuery({
    queryKey: queryKeys.availability.day(date ?? ''),
    queryFn: () =>
      api.get<AvailabilityResponse>(`/availability?date=${encodeURIComponent(date ?? '')}`),
    enabled: date !== null,
    refetchOnWindowFocus: true,
  });
}

/** POST /appointments. The page handles every error (409, 401, ...) itself. */
export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (startAt: string) => api.post<AppointmentResponse>('/appointments', { startAt }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.availability.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myAppointments.all }),
      ]),
    meta: { handlesErrors: true },
  });
}
