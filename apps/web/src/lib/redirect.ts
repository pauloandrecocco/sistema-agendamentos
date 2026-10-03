import { Role } from '@agenda/shared';

/** Where each role lands when there is no `redirect` (RF-01). */
export function getHomePathForRole(role: Role): string {
  return role === Role.ADMIN ? '/admin' : '/agendar';
}

/**
 * Accepts only internal paths, avoiding open redirects: must start with "/" but not with "//" or
 * "/\" (browsers resolve both as protocol-relative URLs to another host). Control characters are
 * refused too, since URL parsing drops tabs/newlines ("/\t/site.com" becomes "//site.com").
 */
export function getSafeRedirect(value: string | null | undefined): string | null {
  if (!value?.startsWith('/') || /\p{Cc}/u.test(value)) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/** "/login?redirect=..." (or "/cadastro?redirect=...") keeping only a safe redirect. */
export function withRedirect(path: string, redirect: string | null | undefined): string {
  const safe = getSafeRedirect(redirect);
  return safe ? `${path}?redirect=${encodeURIComponent(safe)}` : path;
}
