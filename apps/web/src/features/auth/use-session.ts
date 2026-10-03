import type { LoginData, RegisterData, UserResponse } from '@agenda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { fetchSession, SESSION_QUERY_KEY, setSession } from './session';

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    // Changes only through login/register/logout or a 401 elsewhere (see lib/query-client.ts).
    staleTime: Infinity,
    retry: false,
  });
}

// Navigation after login/register is done by RedirectIfAuthenticated, which reacts to the session.

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginData) => api.post<UserResponse>('/auth/login', data),
    onSuccess: ({ user }) => setSession(queryClient, user),
    meta: { handlesErrors: true },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => api.post<UserResponse>('/auth/register', data),
    onSuccess: ({ user }) => setSession(queryClient, user),
    meta: { handlesErrors: true },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => {
      // A full load resets all client state. Navigating and then clearing the session in the SPA
      // would race with the route guard (router updates run in transitions), which could send the
      // user to /login?redirect=<protected page> instead.
      window.location.assign('/agendar');
    },
  });
}
