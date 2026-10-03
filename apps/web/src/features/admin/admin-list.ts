import { isValidDateString, toBusinessDate, type DisplayStatus } from '@agenda/shared';
import type { AdminAppointmentsParams } from '@/lib/query-keys';

export const ADMIN_LIST_PAGE_SIZE = 20;

/** Filters of the "Todos" tab (RF-09), kept in the URL. */
export type AdminListFilters = {
  /** Inclusive start date; defaults to today (the API has no "no lower bound"). */
  from: string;
  to: string | null;
  status: DisplayStatus | null;
  search: string;
  page: number;
};

const STATUS_PARAMS: Record<DisplayStatus, string> = {
  CONFIRMED: 'confirmado',
  COMPLETED: 'concluido',
  CANCELLED: 'cancelado',
};

function statusFromParam(value: string | null): DisplayStatus | null {
  const entry = Object.entries(STATUS_PARAMS).find(([, param]) => param === value);
  return entry ? (entry[0] as DisplayStatus) : null;
}

function validDate(value: string | null): string | null {
  return value && isValidDateString(value) ? value : null;
}

/** Reads `de`, `ate`, `status`, `busca` and `pagina`; invalid values fall back to the defaults. */
export function readListFilters(params: URLSearchParams, today: string): AdminListFilters {
  const page = Number(params.get('pagina'));
  return {
    from: validDate(params.get('de')) ?? today,
    to: validDate(params.get('ate')),
    status: statusFromParam(params.get('status')),
    search: params.get('busca') ?? '',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * `params` with the filters in `patch` applied (other parameters, e.g. the tab, are kept).
 * Changing any filter but the page goes back to page 1; defaults are left out of the URL.
 */
export function writeListFilters(
  params: URLSearchParams,
  patch: Partial<AdminListFilters>,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null | undefined) =>
    value ? next.set(key, value) : next.delete(key);

  if ('from' in patch) set('de', patch.from);
  if ('to' in patch) set('ate', patch.to);
  if ('status' in patch) set('status', patch.status && STATUS_PARAMS[patch.status]);
  if ('search' in patch) set('busca', patch.search?.trim());
  set('pagina', patch.page && patch.page > 1 ? String(patch.page) : null);
  return next;
}

/** True when the period is invalid (`from > to`): the list is not requested. */
export function hasInvalidPeriod(filters: AdminListFilters): boolean {
  return filters.to !== null && filters.from > filters.to;
}

export function toListQuery(filters: AdminListFilters): AdminAppointmentsParams {
  const search = filters.search.trim();
  return {
    from: filters.from,
    ...(filters.to && { to: filters.to }),
    ...(filters.status && { status: filters.status }),
    ...(search && { search }),
    page: filters.page,
    pageSize: ADMIN_LIST_PAGE_SIZE,
  };
}

/** Consecutive items of the same business date (RN-15), in the order they come (by startAt). */
export function groupByBusinessDate<T extends { startAt: string }>(
  items: readonly T[],
): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = toBusinessDate(new Date(item.startAt));
    const last = groups.at(-1);
    if (last?.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
