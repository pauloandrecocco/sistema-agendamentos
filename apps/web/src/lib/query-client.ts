import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setSession } from '@/features/auth/session';
import { ApiError, getErrorMessage, isUnauthenticated } from './api-client';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: unknown;
    /** `handlesErrors`: the caller shows the error itself (e.g. on form fields), so no toast. */
    mutationMeta: { handlesErrors?: boolean };
  }
}

/**
 * A 401 UNAUTHENTICATED on any request means the cookie expired while the app was open: the
 * session is cleared and the route guards send the user to the login (no error toast).
 */
function handleUnauthenticated(error: unknown): boolean {
  if (!isUnauthenticated(error)) return false;
  setSession(queryClient, null);
  return true;
}

function isClientError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleUnauthenticated(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (handleUnauthenticated(error) || mutation.meta?.handlesErrors) return;
      toast.error(getErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      // A 4xx will not change by retrying.
      retry: (failureCount, error) => !isClientError(error) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});
