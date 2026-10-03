import { TZDate } from '@date-fns/tz';
import { BUSINESS_TIMEZONE } from '../constants.js';
import { timeToMinutes } from './time.js';

/**
 * Calendar dates ("YYYY-MM-DD") and months ("YYYY-MM") are always in the business timezone.
 * Pure calendar arithmetic is done in UTC so the machine timezone never leaks in.
 */

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number);
  return { year: year ?? NaN, month: month ?? NaN, day: day ?? NaN };
}

function utcToDateString(utc: Date): string {
  return `${pad(utc.getUTCFullYear(), 4)}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

/** True for a well-formed "YYYY-MM-DD" that exists in the calendar (rejects 2026-02-30). */
export function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { year, month, day } = parseDate(date);
  return utcToDateString(new Date(Date.UTC(year, month - 1, day))) === date;
}

/** True for a well-formed "YYYY-MM" with month 01-12. */
export function isValidMonthString(month: string): boolean {
  const match = /^\d{4}-(\d{2})$/.exec(month);
  const monthNumber = Number(match?.[1]);
  return monthNumber >= 1 && monthNumber <= 12;
}

/** Calendar date of an instant in the business timezone (22:00 in São Paulo = 01:00Z next day, same local day). */
export function toBusinessDate(instant: Date): string {
  const local = new TZDate(instant.getTime(), BUSINESS_TIMEZONE);
  return `${pad(local.getFullYear(), 4)}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** Instant of a business-timezone date + "HH:mm" (09:00 in São Paulo = 12:00Z). */
export function businessDateTimeToInstant(date: string, time: string): Date {
  const { year, month, day } = parseDate(date);
  const minutes = timeToMinutes(time);
  const local = new TZDate(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    BUSINESS_TIMEZONE,
  );
  return new Date(local.getTime());
}

/** Day of the week of a calendar date: 0 = Sunday ... 6 = Saturday. */
export function getWeekday(date: string): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Calendar date `days` days after `date` (negative goes back). */
export function addDaysToDate(date: string, days: number): string {
  const { year, month, day } = parseDate(date);
  return utcToDateString(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Every date of a "YYYY-MM" month, in order. */
export function getMonthDates(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year ?? NaN, monthNumber ?? NaN, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => `${month}-${pad(index + 1)}`);
}

/** Instants bounding a business day: [start of `date`, start of the next day). */
export function getBusinessDayBounds(date: string): { start: Date; end: Date } {
  return {
    start: businessDateTimeToInstant(date, '00:00'),
    end: businessDateTimeToInstant(addDaysToDate(date, 1), '00:00'),
  };
}
