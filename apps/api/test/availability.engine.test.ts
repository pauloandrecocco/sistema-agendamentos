import {
  AppointmentStatus,
  DayAvailabilityStatus,
  businessDateTimeToInstant,
  minutesToTime,
} from '@agenda/shared';
import { describe, expect, it } from 'vitest';
import {
  checkSlot,
  generateDaySlots,
  getAvailableSlots,
  getMonthDayStatuses,
  overlaps,
  type OccupyingAppointment,
} from '../src/modules/availability/availability.engine.js';
import { defaultScheduleConfig, uniformScheduleConfig } from './fixtures/schedule.js';

// October 2026: the 4th is a Sunday, the 5th a Monday.
const MONDAY = '2026-10-05';
const SUNDAY = '2026-10-04';
const at = (date: string, time: string) => businessDateTimeToInstant(date, time);
const startsOf = (slots: { startAt: Date }[]) => slots.map((slot) => slot.startAt.toISOString());
/** A moment before every date used below. */
const EARLIER = new Date('2026-10-01T12:00:00.000Z');

function appointment(
  date: string,
  start: string,
  end: string,
  status: AppointmentStatus = AppointmentStatus.CONFIRMED,
): OccupyingAppointment {
  return { startAt: at(date, start), endAt: at(date, end), status };
}

describe('generateDaySlots (RN-04)', () => {
  it('case 1: inactive weekday -> no slots', () => {
    const slots = generateDaySlots({
      date: SUNDAY,
      config: defaultScheduleConfig(),
      isBlocked: false,
    });
    expect(slots).toEqual([]);
  });

  it('case 2: blocked date -> no slots', () => {
    const slots = generateDaySlots({
      date: MONDAY,
      config: defaultScheduleConfig(),
      isBlocked: true,
    });
    expect(slots).toEqual([]);
  });

  it('case 3: 09:00-12:00 -> 6 slots of 30 min, 3 slots of 60 min', () => {
    const thirty = generateDaySlots({
      date: MONDAY,
      config: uniformScheduleConfig('09:00', '12:00', 30),
      isBlocked: false,
    });
    const sixty = generateDaySlots({
      date: MONDAY,
      config: uniformScheduleConfig('09:00', '12:00', 60),
      isBlocked: false,
    });

    expect(startsOf(thirty)).toEqual(
      ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map((t) =>
        at(MONDAY, t).toISOString(),
      ),
    );
    expect(startsOf(sixty)).toEqual(
      ['09:00', '10:00', '11:00'].map((t) => at(MONDAY, t).toISOString()),
    );
    expect(sixty[2]).toEqual({ startAt: at(MONDAY, '11:00'), endAt: at(MONDAY, '12:00') });
  });

  it('case 4: 09:00-10:30 with 60 min -> only 09:00 (a slot that does not fit is dropped)', () => {
    const slots = generateDaySlots({
      date: MONDAY,
      config: uniformScheduleConfig('09:00', '10:30', 60),
      isBlocked: false,
    });
    expect(slots).toEqual([{ startAt: at(MONDAY, '09:00'), endAt: at(MONDAY, '10:00') }]);
  });

  it('active day whose interval fits no slot -> no slots (not an error)', () => {
    const slots = generateDaySlots({
      date: MONDAY,
      config: uniformScheduleConfig('09:00', '09:30', 60),
      isBlocked: false,
    });
    expect(slots).toEqual([]);
  });

  it('case 8: 09:00 in São Paulo is 12:00Z', () => {
    const [first] = generateDaySlots({
      date: MONDAY,
      config: defaultScheduleConfig(),
      isBlocked: false,
    });
    expect(first?.startAt.toISOString()).toBe('2026-10-05T12:00:00.000Z');
    expect(first?.endAt.toISOString()).toBe('2026-10-05T12:30:00.000Z');
  });

  it('late slots stay on the local day even though they fall on the next UTC day', () => {
    const slots = generateDaySlots({
      date: MONDAY,
      config: uniformScheduleConfig('22:00', '23:30', 30),
      isBlocked: false,
    });
    expect(startsOf(slots)).toEqual([
      '2026-10-06T01:00:00.000Z',
      '2026-10-06T01:30:00.000Z',
      '2026-10-06T02:00:00.000Z',
    ]);
  });
});

describe('getAvailableSlots (RN-05)', () => {
  const config = uniformScheduleConfig('09:00', '12:00', 30);

  it('case 5: today at 10:10 -> first available slot is 10:30', () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      config,
      isBlocked: false,
      appointments: [],
      now: at(MONDAY, '10:10'),
    });
    expect(slots[0]?.startAt).toEqual(at(MONDAY, '10:30'));
    expect(slots).toHaveLength(3);
  });

  it('a slot starting exactly now is no longer available (start > now)', () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      config,
      isBlocked: false,
      appointments: [],
      now: at(MONDAY, '10:30'),
    });
    expect(slots[0]?.startAt).toEqual(at(MONDAY, '11:00'));
  });

  it('case 6: 30-min appointment at 09:30 + duration changed to 60 -> 09:00 unavailable, 10:00 available', () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      config: uniformScheduleConfig('09:00', '12:00', 60),
      isBlocked: false,
      appointments: [appointment(MONDAY, '09:30', '10:00')],
      now: EARLIER,
    });
    expect(startsOf(slots)).toEqual([
      at(MONDAY, '10:00').toISOString(),
      at(MONDAY, '11:00').toISOString(),
    ]);
  });

  it('case 7: a cancelled appointment does not hold the slot', () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      config,
      isBlocked: false,
      appointments: [appointment(MONDAY, '09:00', '09:30', AppointmentStatus.CANCELLED)],
      now: EARLIER,
    });
    expect(slots).toHaveLength(6);
    expect(slots[0]?.startAt).toEqual(at(MONDAY, '09:00'));
  });

  it('adjacent appointments do not conflict ([start, end))', () => {
    const slots = getAvailableSlots({
      date: MONDAY,
      config,
      isBlocked: false,
      appointments: [appointment(MONDAY, '09:30', '10:00')],
      now: EARLIER,
    });
    expect(startsOf(slots)).toEqual(
      ['09:00', '10:00', '10:30', '11:00', '11:30'].map((t) => at(MONDAY, t).toISOString()),
    );
  });
});

describe('overlaps', () => {
  it('uses half-open intervals', () => {
    const a = { startAt: at(MONDAY, '09:00'), endAt: at(MONDAY, '10:00') };
    const slot = (start: string, end: string) => ({
      startAt: at(MONDAY, start),
      endAt: at(MONDAY, end),
    });
    expect(overlaps(a, slot('09:30', '10:30'))).toBe(true);
    expect(overlaps(a, slot('08:00', '11:00'))).toBe(true);
    expect(overlaps(a, slot('10:00', '10:30'))).toBe(false);
    expect(overlaps(a, slot('08:30', '09:00'))).toBe(false);
  });
});

describe('checkSlot (RN-06)', () => {
  const base = {
    config: defaultScheduleConfig(),
    isBlocked: false,
    appointments: [] as OccupyingAppointment[],
    now: at(MONDAY, '10:10'),
  };
  const sixty = defaultScheduleConfig({ slotDurationMinutes: 60 });

  it('returns the generated slot when it is free', () => {
    expect(checkSlot({ ...base, startAt: at(MONDAY, '14:00') })).toEqual({
      result: 'OK',
      slot: { startAt: at(MONDAY, '14:00'), endAt: at(MONDAY, '14:30') },
    });
  });

  it('IN_PAST for a start before or exactly at now, even if misaligned', () => {
    expect(checkSlot({ ...base, startAt: at(MONDAY, '10:00') }).result).toBe('IN_PAST');
    expect(checkSlot({ ...base, startAt: at(MONDAY, '10:10') }).result).toBe('IN_PAST');
    expect(checkSlot({ ...base, startAt: at(MONDAY, '09:07') }).result).toBe('IN_PAST');
  });

  it('NOT_AVAILABLE for a closed day, a blocked day, outside working hours or misaligned', () => {
    const sunday = at('2026-10-11', '10:00');
    const oneMsLate = new Date(at(MONDAY, '14:00').getTime() + 1);

    expect(checkSlot({ ...base, startAt: sunday }).result).toBe('NOT_AVAILABLE');
    expect(checkSlot({ ...base, isBlocked: true, startAt: at(MONDAY, '14:00') }).result).toBe(
      'NOT_AVAILABLE',
    );
    expect(checkSlot({ ...base, startAt: at(MONDAY, '18:00') }).result).toBe('NOT_AVAILABLE');
    expect(checkSlot({ ...base, startAt: at(MONDAY, '17:45') }).result).toBe('NOT_AVAILABLE');
    expect(checkSlot({ ...base, startAt: at('2026-10-06', '07:00') }).result).toBe('NOT_AVAILABLE');
    expect(checkSlot({ ...base, startAt: at(MONDAY, '14:15') }).result).toBe('NOT_AVAILABLE');
    expect(checkSlot({ ...base, startAt: oneMsLate }).result).toBe('NOT_AVAILABLE');
  });

  it('NOT_AVAILABLE for a :30 start when the duration is 60', () => {
    expect(checkSlot({ ...base, config: sixty, startAt: at(MONDAY, '14:30') }).result).toBe(
      'NOT_AVAILABLE',
    );
  });

  it('BOOKED when it overlaps a CONFIRMED appointment, including a partial overlap after 30 -> 60', () => {
    const appointments = [appointment(MONDAY, '14:30', '15:00')];

    expect(checkSlot({ ...base, appointments, startAt: at(MONDAY, '14:30') }).result).toBe(
      'BOOKED',
    );
    expect(
      checkSlot({ ...base, config: sixty, appointments, startAt: at(MONDAY, '14:00') }).result,
    ).toBe('BOOKED');
    expect(
      checkSlot({ ...base, config: sixty, appointments, startAt: at(MONDAY, '15:00') }),
    ).toEqual({ result: 'OK', slot: { startAt: at(MONDAY, '15:00'), endAt: at(MONDAY, '16:00') } });
  });

  it('a cancelled appointment does not make the slot BOOKED', () => {
    const appointments = [appointment(MONDAY, '14:00', '14:30', AppointmentStatus.CANCELLED)];
    expect(checkSlot({ ...base, appointments, startAt: at(MONDAY, '14:00') }).result).toBe('OK');
  });

  it('uses the business date of startAt (22:00 SP is 01:00Z of the next UTC day)', () => {
    const late = uniformScheduleConfig('21:00', '23:00', 30);
    const startAt = at(MONDAY, '22:00');
    expect(startAt.toISOString()).toBe('2026-10-06T01:00:00.000Z');
    expect(checkSlot({ ...base, config: late, startAt }).result).toBe('OK');
  });
});

describe('getMonthDayStatuses (case 9)', () => {
  const config = defaultScheduleConfig();
  const statusOf = (days: { date: string; status: string }[], date: string) =>
    days.find((day) => day.date === date)?.status;

  it('classifies PAST, CLOSED, BLOCKED, AVAILABLE and NO_SLOTS', () => {
    // Today = Monday 2026-10-05 at 17:45 local: the last slot (17:30) has already started.
    const now = at(MONDAY, '17:45');
    // Wednesday 2026-10-07 fully booked: 18 appointments from 09:00 to 18:00.
    const fullDay = Array.from({ length: 18 }, (_, index) => {
      const startAt = at('2026-10-07', minutesToTime(9 * 60 + index * 30));
      return {
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        status: AppointmentStatus.CONFIRMED,
      };
    });

    const days = getMonthDayStatuses({
      month: '2026-10',
      config,
      blockedDates: new Set(['2026-10-08', '2026-10-11']),
      appointments: fullDay,
      now,
    });

    expect(days).toHaveLength(31);
    expect(statusOf(days, '2026-10-01')).toBe(DayAvailabilityStatus.PAST);
    expect(statusOf(days, SUNDAY)).toBe(DayAvailabilityStatus.PAST); // PAST wins over CLOSED
    expect(statusOf(days, MONDAY)).toBe(DayAvailabilityStatus.NO_SLOTS); // today, nothing left
    expect(statusOf(days, '2026-10-06')).toBe(DayAvailabilityStatus.AVAILABLE);
    expect(statusOf(days, '2026-10-07')).toBe(DayAvailabilityStatus.NO_SLOTS); // fully booked
    expect(statusOf(days, '2026-10-08')).toBe(DayAvailabilityStatus.BLOCKED);
    expect(statusOf(days, '2026-10-10')).toBe(DayAvailabilityStatus.AVAILABLE); // Saturday
    expect(statusOf(days, '2026-10-11')).toBe(DayAvailabilityStatus.BLOCKED); // BLOCKED wins over CLOSED
    expect(statusOf(days, '2026-10-18')).toBe(DayAvailabilityStatus.CLOSED);
  });

  it('today with slots left is AVAILABLE', () => {
    const days = getMonthDayStatuses({
      month: '2026-10',
      config,
      blockedDates: new Set(),
      appointments: [],
      now: at(MONDAY, '17:10'),
    });
    expect(statusOf(days, MONDAY)).toBe(DayAvailabilityStatus.AVAILABLE);
  });

  it('"today" follows the business timezone and a past month is entirely PAST', () => {
    // 2026-11-01T02:00Z is still Saturday October 31 (23:00) in São Paulo.
    const now = new Date('2026-11-01T02:00:00.000Z');
    const base = { config, blockedDates: new Set<string>(), appointments: [], now };

    const october = getMonthDayStatuses({ ...base, month: '2026-10' });
    expect(statusOf(october, '2026-10-30')).toBe(DayAvailabilityStatus.PAST);
    expect(statusOf(october, '2026-10-31')).toBe(DayAvailabilityStatus.NO_SLOTS);

    const september = getMonthDayStatuses({ ...base, month: '2026-09' });
    expect(september.every((day) => day.status === DayAvailabilityStatus.PAST)).toBe(true);
  });
});
