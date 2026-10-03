/**
 * Conversions for `@db.Date` columns (blocked_dates): Prisma reads and writes them as a Date at
 * midnight UTC, so the calendar date is the UTC part of it. Never use the machine timezone here.
 */
export function dbDateToString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function stringToDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
