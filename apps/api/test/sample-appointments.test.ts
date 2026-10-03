import {
  AppointmentStatus,
  CancelledBy,
  getDisplayStatus,
  getWeekday,
  toBusinessDate,
} from '@agenda/shared';
import { describe, expect, it } from 'vitest';
import { buildSampleAppointments } from '../prisma/sample-appointments.js';
import { generateDaySlots, overlaps } from '../src/modules/availability/availability.engine.js';
import { defaultScheduleConfig } from './fixtures/schedule.js';

// Monday 2026-10-05 10:10 in São Paulo.
const NOW = new Date('2026-10-05T13:10:00.000Z');
const MARIA = 'maria-id';
const JOAO = 'joao-id';

function build(options: { blockedDates?: string[]; now?: Date } = {}) {
  return buildSampleAppointments({
    now: options.now ?? NOW,
    config: defaultScheduleConfig(),
    blockedDates: new Set(options.blockedDates ?? []),
    mariaId: MARIA,
    joaoId: JOAO,
  });
}

describe('buildSampleAppointments', () => {
  it('creates the distribution of PRD 14.4', () => {
    const appointments = build()!;
    const summary = appointments.map((appointment) => [
      appointment.clientId,
      getDisplayStatus(appointment, NOW),
      appointment.cancelledBy,
      appointment.startAt > NOW ? 'future' : 'past',
    ]);

    expect(summary).toEqual([
      [MARIA, 'COMPLETED', null, 'past'],
      [JOAO, 'CANCELLED', CancelledBy.CLIENT, 'past'],
      [MARIA, 'COMPLETED', null, 'past'],
      [MARIA, 'CONFIRMED', null, 'future'],
      [JOAO, 'CONFIRMED', null, 'future'],
      [MARIA, 'CANCELLED', CancelledBy.ADMIN, 'future'],
      [MARIA, 'CONFIRMED', null, 'future'],
    ]);
  });

  it('only uses generated slots: aligned, inside working hours, never on closed days', () => {
    const config = defaultScheduleConfig();
    for (const appointment of build()!) {
      const date = toBusinessDate(appointment.startAt);
      expect(getWeekday(date)).not.toBe(0); // Sunday is closed
      const slots = generateDaySlots({ date, config, isBlocked: false });
      expect(slots).toContainEqual({ startAt: appointment.startAt, endAt: appointment.endAt });
    }
  });

  it('skips blocked days and today, and never overlaps', () => {
    const appointments = build({ blockedDates: ['2026-10-06', '2026-10-02'] })!;
    const dates = appointments.map((appointment) => toBusinessDate(appointment.startAt));

    // Past: Sat 3rd, (Fri 2nd blocked), Thu 1st, Wed Sep 30. Future: (Tue 6th blocked), Wed 7th...
    expect(dates).toEqual([
      '2026-10-03',
      '2026-10-01',
      '2026-09-30',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(new Set(dates).size).toBe(dates.length);
    for (const [index, a] of appointments.entries()) {
      for (const b of appointments.slice(index + 1)) expect(overlaps(a, b)).toBe(false);
    }
  });

  it('keeps the history consistent: createdAt < startAt, createdAt <= now, cancellation after creation', () => {
    for (const appointment of build()!) {
      expect(appointment.createdAt < appointment.startAt).toBe(true);
      expect(appointment.createdAt <= NOW).toBe(true);
      if (appointment.status === AppointmentStatus.CANCELLED) {
        expect(appointment.cancelledAt! > appointment.createdAt).toBe(true);
        expect(appointment.cancelledAt! <= NOW).toBe(true);
      } else {
        expect(appointment.cancelledAt).toBeNull();
      }
    }
  });

  it('returns null when there are not enough open days', () => {
    const closed = defaultScheduleConfig();
    for (const row of closed.workingHours) row.isActive = false;
    expect(
      buildSampleAppointments({
        now: NOW,
        config: closed,
        blockedDates: new Set(),
        mariaId: MARIA,
        joaoId: JOAO,
      }),
    ).toBeNull();
  });
});
