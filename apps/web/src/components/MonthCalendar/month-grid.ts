import { addDaysToDate, getMonthDates, getWeekday } from '@agenda/shared';

/** One week row of the grid: 7 cells, Sunday first; `null` pads days outside the month. */
export type MonthGridWeek = (string | null)[];

/** Weeks of a "YYYY-MM" month, built from calendar-date strings (no machine timezone involved). */
export function buildMonthGrid(month: string): MonthGridWeek[] {
  const dates = getMonthDates(month);
  const cells: (string | null)[] = [
    ...Array.from({ length: getWeekday(dates[0]!) }, () => null),
    ...dates,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: MonthGridWeek[] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** Every date from `a` to `b`, inclusive, in order (the arguments may come in any order). */
export function getDateRange(a: string, b: string): string[] {
  const [first, last] = a <= b ? [a, b] : [b, a];
  const dates: string[] = [];
  for (let date = first; date <= last; date = addDaysToDate(date, 1)) dates.push(date);
  return dates;
}

/**
 * Selection while dragging from `anchor` to `current`: what was selected when the drag started
 * plus the dragged range, leaving out days that cannot be selected (e.g. past days).
 */
export function applyDragSelection(
  snapshot: ReadonlySet<string>,
  anchor: string,
  current: string,
  isSelectable: (date: string) => boolean,
): Set<string> {
  const next = new Set(snapshot);
  for (const date of getDateRange(anchor, current)) {
    if (isSelectable(date)) next.add(date);
  }
  return next;
}

/** `selection` with `date` added or removed. */
export function toggleDate(selection: ReadonlySet<string>, date: string): Set<string> {
  const next = new Set(selection);
  if (!next.delete(date)) next.add(date);
  return next;
}
