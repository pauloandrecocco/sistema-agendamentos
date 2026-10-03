import { describe, expect, it } from 'vitest';
import { availabilityCalendarQuerySchema, availabilityDayQuerySchema } from './availability.js';

describe('availability query schemas', () => {
  it('accepts a valid month and date', () => {
    expect(availabilityCalendarQuerySchema.parse({ month: '2026-10' })).toEqual({
      month: '2026-10',
    });
    expect(availabilityDayQuerySchema.parse({ date: '2026-10-05' })).toEqual({
      date: '2026-10-05',
    });
  });

  it('rejects malformed or impossible values', () => {
    for (const month of ['2026-13', '2026-1', '10-2026', undefined]) {
      expect(availabilityCalendarQuerySchema.safeParse({ month }).success).toBe(false);
    }
    for (const date of ['2026-02-30', '2026-10-5', '05/10/2026', undefined]) {
      expect(availabilityDayQuerySchema.safeParse({ date }).success).toBe(false);
    }
  });
});
