import type { Role } from '@agenda/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { PageError, PageLoading } from '@/components/PageStatus';
import { getHomePathForRole, withRedirect } from '@/lib/redirect';
import { useSession } from './use-session';

/** Route guard (PRD 15.1): logged out → login with redirect back; wrong role → own home page. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <PageLoading />;
  if (session.isError) return <PageError onRetry={() => void session.refetch()} />;

  const user = session.data;
  if (!user) {
    return <Navigate to={withRedirect('/login', location.pathname + location.search)} replace />;
  }
  if (user.role !== role) return <Navigate to={getHomePathForRole(user.role)} replace />;
  return children;
}
