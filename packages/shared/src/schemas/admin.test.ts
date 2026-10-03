import { describe, expect, it } from 'vitest';
import { addDaysToDate } from '../helpers/business-date.js';
import {
  adminAppointmentsQuerySchema,
  blockDatesSchema,
  scheduleConfigSchema,
  type ScheduleConfigInput,
} from './admin.js';

function validConfig(): ScheduleConfigInput {
  return {
    slotDurationMinutes: 30,
    workingHours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isActive: weekday !== 0,
      startTime: '09:00',
      endTime: '18:00',
    })),
  };
}

describe('adminAppointmentsQuerySchema', () => {
  it('applies defaults and coerces numbers', () => {
    expect(adminAppointmentsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(
      adminAppointmentsQuerySchema.parse({
        from: '2026-10-01',
        to: '2026-10-01',
        status: 'COMPLETED',
        search: '  maria ',
        page: '2',
        pageSize: '100',
      }),
    ).toEqual({
      from: '2026-10-01',
      to: '2026-10-01',
      status: 'COMPLETED',
      search: 'maria',
      page: 2,
      pageSize: 100,
    });
  });

  it('treats a blank search as absent', () => {
    expect(adminAppointmentsQuerySchema.parse({ search: '   ' }).search).toBeUndefined();
  });

  it('rejects invalid values', () => {
    for (const query of [
      { from: '2026-02-30' },
      { status: 'PENDING' },
      { page: '0' },
      { page: '1.5' },
      { pageSize: '101' },
      { pageSize: 'abc' },
      { search: 'x'.repeat(101) },
    ]) {
      expect(adminAppointmentsQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(
        false,
      );
    }
  });

  it('rejects from after to', () => {
    const result = adminAppointmentsQuerySchema.safeParse({ from: '2026-10-02', to: '2026-10-01' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['to']);
  });
});

describe('scheduleConfigSchema', () => {
  it('accepts a valid configuration and orders the rows by weekday', () => {
    const config = validConfig();
    config.workingHours.reverse();
    const parsed = scheduleConfigSchema.parse(config);
    expect(parsed.workingHours.map((row) => row.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('accepts 60 minutes and rejects other durations', () => {
    expect(
      scheduleConfigSchema.safeParse({ ...validConfig(), slotDurationMinutes: 60 }).success,
    ).toBe(true);
    for (const slotDurationMinutes of [15, 45, 90, '30']) {
      expect(
        scheduleConfigSchema.safeParse({ ...validConfig(), slotDurationMinutes }).success,
      ).toBe(false);
    }
  });

  it('only accepts times on :00 or :30 between 00:00 and 23:30', () => {
    for (const startTime of ['09:15', '9:00', '24:00', '23:59']) {
      const config = validConfig();
      config.workingHours[1]!.startTime = startTime;
      expect(scheduleConfigSchema.safeParse(config).success, startTime).toBe(false);
    }
  });

  it('requires endTime > startTime, also on inactive days', () => {
    for (const [weekday, endTime] of [
      [1, '09:00'],
      [0, '08:30'],
    ] as const) {
      const config = validConfig();
      config.workingHours[weekday]!.endTime = endTime;
      const result = scheduleConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(['workingHours', weekday, 'endTime']);
    }
  });

  it('requires the 7 weekdays exactly once', () => {
    const missing = validConfig();
    missing.workingHours.pop();
    expect(scheduleConfigSchema.safeParse(missing).success).toBe(false);

    const repeated = validConfig();
    repeated.workingHours[6]!.weekday = 1;
    expect(scheduleConfigSchema.safeParse(repeated).success).toBe(false);
  });
});

describe('blockDatesSchema', () => {
  it('deduplicates and sorts the dates', () => {
    expect(
      blockDatesSchema.parse({ dates: ['2026-10-07', '2026-10-05', '2026-10-07'] }).dates,
    ).toEqual(['2026-10-05', '2026-10-07']);
  });

  it('requires 1 to 92 valid dates', () => {
    expect(blockDatesSchema.safeParse({ dates: [] }).success).toBe(false);
    expect(blockDatesSchema.safeParse({ dates: ['2026-02-30'] }).success).toBe(false);
    expect(blockDatesSchema.safeParse({}).success).toBe(false);
    const dates = Array.from({ length: 93 }, (_, index) => addDaysToDate('2027-01-01', index));
    expect(blockDatesSchema.safeParse({ dates }).success).toBe(false);
    expect(blockDatesSchema.safeParse({ dates: dates.slice(0, 92) }).success).toBe(true);
  });
});
