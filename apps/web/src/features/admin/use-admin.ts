import type {
  AdminAppointmentListResponse,
  AdminCalendarResponse,
  AdminSummaryResponse,
  AppointmentResponse,
  BlockDatesResponse,
  ScheduleConfigData,
  ScheduleConfigResponse,
  UnblockDatesResponse,
} from '@agenda/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { queryKeys, type AdminAppointmentsParams } from '@/lib/query-keys';

/**
 * After a cancellation, a block/unblock or a schedule change: the admin summary, calendar and
 * lists, the public availability and the client's lists are all outdated. Also called when the
 * action fails, since the failure (e.g. "already started") usually means the screen was stale.
 */
export function invalidateAgendaQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.availability.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.myAppointments.all }),
  ]);
}

export function useAdminSummary() {
  return useQuery({
    queryKey: queryKeys.admin.summary,
    queryFn: () => api.get<AdminSummaryResponse>('/admin/summary'),
    refetchOnWindowFocus: true,
  });
}

export function useAdminCalendar(month: string) {
  return useQuery({
    queryKey: queryKeys.admin.calendar(month),
    queryFn: () => fetchAdminCalendar(month),
    refetchOnWindowFocus: true,
  });
}

export function fetchAdminCalendar(month: string) {
  return api.get<AdminCalendarResponse>(`/admin/calendar?month=${encodeURIComponent(month)}`);
}

/**
 * GET /admin/appointments. `keepPrevious` keeps the current page on screen while the next one
 * loads (pagination); without it a new query (e.g. another day) starts pending.
 */
export function useAdminAppointments(
  params: AdminAppointmentsParams,
  { enabled = true, keepPrevious = false }: { enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.admin.appointments(params),
    queryFn: () => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, String(value));
      }
      return api.get<AdminAppointmentListResponse>(`/admin/appointments?${search.toString()}`);
    },
    enabled,
    refetchOnWindowFocus: true,
    ...(keepPrevious && { placeholderData: keepPreviousData }),
  });
}

/** Errors (RN-08) are shown as toast by the query client. */
export function useAdminCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<AppointmentResponse>(`/admin/appointments/${encodeURIComponent(id)}/cancel`),
    onSettled: () => invalidateAgendaQueries(queryClient),
  });
}

export function useBlockDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dates: string[]) =>
      api.post<BlockDatesResponse>('/admin/blocked-dates', { dates }),
    onSettled: () => invalidateAgendaQueries(queryClient),
  });
}

export function useUnblockDates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dates: string[]) =>
      api.post<UnblockDatesResponse>('/admin/blocked-dates/unblock', { dates }),
    onSettled: () => invalidateAgendaQueries(queryClient),
  });
}

export function useScheduleConfig() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: () => api.get<ScheduleConfigResponse>('/admin/schedule'),
  });
}

/** The settings page shows field errors itself (`handlesErrors`). */
export function useSaveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: ScheduleConfigData) =>
      api.put<ScheduleConfigResponse>('/admin/schedule', config),
    onSuccess: (config) => queryClient.setQueryData(queryKeys.schedule, config),
    onSettled: () => invalidateAgendaQueries(queryClient),
    meta: { handlesErrors: true },
  });
}
