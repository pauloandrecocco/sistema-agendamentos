import type { PublicUser } from '@agenda/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_QUERY_KEY } from '@/features/auth/session';
import { ApiError } from './api-client';
import { queryClient } from './query-client';

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const maria: PublicUser = {
  id: 'u1',
  name: 'Maria Silva',
  email: 'maria@email.com',
  phone: null,
  role: 'CLIENT',
};

function runMutation(error: unknown, meta?: { handlesErrors?: boolean }) {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationFn: () => Promise.reject(error instanceof Error ? error : new Error('x')),
    meta,
  });
  return mutation.execute(undefined).catch(() => undefined);
}

afterEach(() => {
  queryClient.clear();
  toastError.mockReset();
});

describe('queryClient error handling', () => {
  it('clears the session on 401 UNAUTHENTICATED from a query, without toast', async () => {
    queryClient.setQueryData(SESSION_QUERY_KEY, maria);

    await queryClient
      .fetchQuery({
        queryKey: ['appointments'],
        queryFn: () => Promise.reject(new ApiError(401, 'UNAUTHENTICATED', 'Sessão expirada.')),
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('clears the session on 401 UNAUTHENTICATED from a mutation, without toast', async () => {
    queryClient.setQueryData(SESSION_QUERY_KEY, maria);

    await runMutation(new ApiError(401, 'UNAUTHENTICATED', 'Sessão expirada.'));

    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows other mutation errors as toast and keeps the session', async () => {
    queryClient.setQueryData(SESSION_QUERY_KEY, maria);

    await runMutation(new ApiError(422, 'APPOINTMENT_ALREADY_STARTED', 'Já iniciado.'));

    expect(toastError).toHaveBeenCalledWith('Já iniciado.');
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(maria);
  });

  it('does not toast when the mutation handles its own errors', async () => {
    await runMutation(new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'x'), { handlesErrors: true });

    expect(toastError).not.toHaveBeenCalled();
  });
});
