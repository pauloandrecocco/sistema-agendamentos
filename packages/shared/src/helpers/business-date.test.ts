import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  addMonthsToMonth,
  businessDateTimeToInstant,
  getBusinessDayBounds,
  getMonthDates,
  getMonthOfDate,
  getWeekday,
  isValidDateString,
  isValidMonthString,
  toBusinessDate,
} from './business-date.js';

describe('business timezone conversions (America/Sao_Paulo)', () => {
  it('09:00 in São Paulo is 12:00Z', () => {
    expect(businessDateTimeToInstant('2026-10-05', '09:00').toISOString()).toBe(
      '2026-10-05T12:00:00.000Z',
    );
  });

  it('22:00 in São Paulo (01:00Z next day) belongs to the local day', () => {
    const instant = businessDateTimeToInstant('2026-10-05', '22:00');
    expect(instant.toISOString()).toBe('2026-10-06T01:00:00.000Z');
    expect(toBusinessDate(instant)).toBe('2026-10-05');
  });

  it('day bounds are local midnights', () => {
    expect(getBusinessDayBounds('2026-10-05')).toEqual({
      start: new Date('2026-10-05T03:00:00.000Z'),
      end: new Date('2026-10-06T03:00:00.000Z'),
    });
  });
});

describe('calendar helpers', () => {
  it('weekday of a date (0 = Sunday)', () => {
    expect(getWeekday('2026-10-04')).toBe(0);
    expect(getWeekday('2026-10-05')).toBe(1);
    expect(getWeekday('2026-10-10')).toBe(6);
  });

  it('adds days across months and years', () => {
    expect(addDaysToDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists every date of a month', () => {
    expect(getMonthDates('2026-02')).toHaveLength(28);
    expect(getMonthDates('2028-02').at(-1)).toBe('2028-02-29');
    expect(getMonthDates('2026-10')[0]).toBe('2026-10-01');
  });

  it('validates date and month strings', () => {
    expect(isValidDateString('2026-10-05')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-10-5')).toBe(false);
    expect(isValidMonthString('2026-10')).toBe(true);
    expect(isValidMonthString('2026-13')).toBe(false);
    expect(isValidMonthString('2026-00')).toBe(false);
  });

  it('adds months across years, forwards and backwards', () => {
    expect(addMonthsToMonth('2026-10', 1)).toBe('2026-11');
    expect(addMonthsToMonth('2026-12', 1)).toBe('2027-01');
    expect(addMonthsToMonth('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToMonth('2026-10', -14)).toBe('2025-08');
  });

  it('month of a date', () => {
    expect(getMonthOfDate('2026-10-05')).toBe('2026-10');
  });
});
