import type {
  AppointmentListResponse,
  AppointmentResponse,
  AppointmentScope,
} from '@agenda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useMyAppointments(scope: AppointmentScope) {
  return useQuery({
    queryKey: queryKeys.myAppointments.list(scope),
    queryFn: () => api.get<AppointmentListResponse>(`/appointments/me?scope=${scope}`),
    // Statuses and "upcoming" depend on the time: back on the tab, the list is checked again.
    refetchOnWindowFocus: true,
  });
}

/**
 * POST /appointments/:id/cancel. Errors (RN-08) are shown as toast by the query client. Success
 * frees the slot; a failure (e.g. it already started) means the list is outdated: both refresh.
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAppointments.all });
    },
  });
}
