import { getMonthDates, getWeekday } from '@agenda/shared';

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
