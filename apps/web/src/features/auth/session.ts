import type { PublicUser, UserResponse } from '@agenda/shared';
import type { QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';

export const SESSION_QUERY_KEY = ['session'] as const;

/** Current user, or null when not logged in: a 401 from /auth/me is a state, not an error. */
export async function fetchSession(): Promise<PublicUser | null> {
  try {
    const { user } = await api.get<UserResponse>('/auth/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/**
 * Replaces the session and drops every other cached query, so data of a previous user never
 * shows up for the next one. Route guards react to the new session value.
 */
export function setSession(queryClient: QueryClient, user: PublicUser | null): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] });
  queryClient.setQueryData(SESSION_QUERY_KEY, user);
}
