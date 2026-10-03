/**
 * Example appointments of the seed (PRD section 14.4), planned by a pure function so it can be tested.
 * Slots come from the availability engine with the real configuration and blocked dates, so every
 * appointment is aligned, inside working hours and never on a closed or blocked day. Each one gets
 * its own day, so they never overlap.
 */
import {
  AppointmentStatus,
  CancelledBy,
  addDaysToDate,
  toBusinessDate,
  type ScheduleConfig,
} from '@agenda/shared';
import { generateDaySlots, type Slot } from '../src/modules/availability/availability.engine.js';

export type SampleAppointment = {
  clientId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  cancelledBy: CancelledBy | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

type Kind = 'COMPLETED' | 'CANCELLED_BY_CLIENT' | 'CONFIRMED' | 'CANCELLED_BY_ADMIN';

/** How far to look for open days in each direction. */
export const SAMPLE_SEARCH_DAYS = 60;
/** Preferred slot of the day per appointment (clamped to the last slot), for varied times. */
const PREFERRED_SLOT_INDEXES = [2, 6, 4, 10, 1, 8, 3];

const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;

/** First `count` open days walking from `start` by `step` (+1 future, -1 past). */
function findOpenDays(
  start: string,
  step: 1 | -1,
  count: number,
  config: ScheduleConfig,
  blockedDates: ReadonlySet<string>,
): Slot[][] {
  const days: Slot[][] = [];
  for (let offset = 0; offset < SAMPLE_SEARCH_DAYS && days.length < count; offset++) {
    const date = addDaysToDate(start, offset * step);
    const slots = generateDaySlots({ date, config, isBlocked: blockedDates.has(date) });
    if (slots.length > 0) days.push(slots);
  }
  return days;
}

/**
 * 2 completed (Maria) + 1 cancelled by the client (João) in the past; 3 confirmed (Maria, João,
 * Maria) + 1 cancelled by the admin (Maria) from tomorrow on. Returns null when there are not
 * enough open days (e.g. every weekday inactive).
 *
 * They represent history: `createdAt` is before `startAt` (booked while still in the future) and
 * never after `now`, consistent with the rule that nothing is booked in the past.
 */
export function buildSampleAppointments(input: {
  now: Date;
  config: ScheduleConfig;
  blockedDates: ReadonlySet<string>;
  mariaId: string;
  joaoId: string;
}): SampleAppointment[] | null {
  const { now, config, blockedDates, mariaId, joaoId } = input;
  const today = toBusinessDate(now);

  const pastPlan: [Kind, string][] = [
    ['COMPLETED', mariaId],
    ['CANCELLED_BY_CLIENT', joaoId],
    ['COMPLETED', mariaId],
  ];
  const futurePlan: [Kind, string][] = [
    ['CONFIRMED', mariaId],
    ['CONFIRMED', joaoId],
    ['CANCELLED_BY_ADMIN', mariaId],
    ['CONFIRMED', mariaId],
  ];

  const pastDays = findOpenDays(
    addDaysToDate(today, -1),
    -1,
    pastPlan.length,
    config,
    blockedDates,
  );
  const futureDays = findOpenDays(
    addDaysToDate(today, 1),
    1,
    futurePlan.length,
    config,
    blockedDates,
  );
  if (pastDays.length < pastPlan.length || futureDays.length < futurePlan.length) return null;

  const plan = [...pastPlan, ...futurePlan];
  const days = [...pastDays, ...futureDays];

  return plan.map(([kind, clientId], index) => {
    const slots = days[index]!;
    const preferred = PREFERRED_SLOT_INDEXES[index % PREFERRED_SLOT_INDEXES.length]!;
    const { startAt, endAt } = slots[Math.min(preferred, slots.length - 1)]!;
    const isPast = startAt <= now;
    // Past: booked 3 days before it started. Future: booked yesterday.
    const createdAt = isPast
      ? new Date(startAt.getTime() - 3 * DAY_MS)
      : new Date(now.getTime() - DAY_MS);

    const base = { clientId, startAt, endAt, createdAt };
    switch (kind) {
      case 'COMPLETED':
      case 'CONFIRMED':
        return {
          ...base,
          status: AppointmentStatus.CONFIRMED,
          cancelledBy: null,
          cancelledAt: null,
        };
      case 'CANCELLED_BY_CLIENT':
        // Cancelled by the client one day before it would start.
        return {
          ...base,
          status: AppointmentStatus.CANCELLED,
          cancelledBy: CancelledBy.CLIENT,
          cancelledAt: new Date(startAt.getTime() - DAY_MS),
        };
      case 'CANCELLED_BY_ADMIN':
        return {
          ...base,
          status: AppointmentStatus.CANCELLED,
          cancelledBy: CancelledBy.ADMIN,
          cancelledAt: new Date(now.getTime() - HOUR_MS),
        };
    }
  });
}
