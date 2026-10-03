import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { PageError, PageLoading } from '@/components/PageStatus';
import { getHomePathForRole, getSafeRedirect } from '@/lib/redirect';
import { useSession } from './use-session';

/**
 * Login/register pages are for logged-out users. Once a session exists (already logged in, or
 * right after a successful login/register) it goes to the safe `redirect` or the role's home.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const session = useSession();
  const [searchParams] = useSearchParams();

  if (session.isPending) return <PageLoading />;
  if (session.isError) return <PageError onRetry={() => void session.refetch()} />;

  const user = session.data;
  if (user) {
    const target = getSafeRedirect(searchParams.get('redirect')) ?? getHomePathForRole(user.role);
    return <Navigate to={target} replace />;
  }
  return children;
}
