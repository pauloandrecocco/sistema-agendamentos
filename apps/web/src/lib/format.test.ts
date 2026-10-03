import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatInstantDate,
  formatInstantWeekdayDate,
  formatLongDate,
  formatMonthLabel,
  formatTime,
  getBusinessToday,
} from './format';

describe('format (business timezone, pt-BR)', () => {
  it('formats an instant in São Paulo time, not UTC', () => {
    // 00:30Z on the 6th is 21:30 on the 5th in São Paulo.
    expect(formatTime('2026-10-06T00:30:00.000Z')).toBe('21:30');
    expect(formatInstantDate('2026-10-06T00:30:00.000Z')).toBe('05/10/2026');
    expect(formatInstantWeekdayDate('2026-10-06T00:30:00.000Z')).toBe('segunda-feira, 05/10/2026');
  });

  it('formats calendar dates without shifting the day', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatLongDate('2026-10-05')).toBe('segunda-feira, 5 de outubro de 2026');
    expect(formatMonthLabel('2026-10')).toBe('outubro de 2026');
  });

  it('today is the São Paulo date', () => {
    expect(getBusinessToday(new Date('2026-10-06T02:00:00.000Z'))).toBe('2026-10-05');
  });
});
