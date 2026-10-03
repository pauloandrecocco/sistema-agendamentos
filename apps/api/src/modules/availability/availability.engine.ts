/**
 * Availability engine: pure functions (no I/O, `now` always injected).
 * The single source of slot rules, used both to list availability and to validate a booking (RN-06).
 */
import {
  AppointmentStatus,
  DayAvailabilityStatus,
  businessDateTimeToInstant,
  getMonthDates,
  getWeekday,
  minutesToTime,
  timeToMinutes,
  toBusinessDate,
  type ScheduleConfig,
} from '@agenda/shared';

export type Slot = { startAt: Date; endAt: Date };

/** What the engine needs from an appointment; non-CONFIRMED ones never hold a slot. */
export type OccupyingAppointment = { startAt: Date; endAt: Date; status: AppointmentStatus };

/** Half-open intervals [start, end): 09:00-09:30 and 09:30-10:00 do not overlap. */
export function overlaps(a: Slot, b: Slot): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

function isFree(slot: Slot, appointments: readonly OccupyingAppointment[]): boolean {
  return !appointments.some(
    (appointment) =>
      appointment.status === AppointmentStatus.CONFIRMED && overlaps(slot, appointment),
  );
}

function getWorkingHours(config: ScheduleConfig, date: string) {
  return config.workingHours.find((row) => row.weekday === getWeekday(date));
}

/** False for a "closed" day: its weekday is inactive in the weekly working hours. */
export function isWeekdayActive(config: ScheduleConfig, date: string): boolean {
  return getWorkingHours(config, date)?.isActive ?? false;
}

/** RN-04: slots of a day from the weekly working hours, ignoring occupation and "now". */
export function generateDaySlots(input: {
  date: string;
  config: ScheduleConfig;
  isBlocked: boolean;
}): Slot[] {
  const { date, config, isBlocked } = input;
  if (isBlocked) return [];

  const hours = getWorkingHours(config, date);
  if (!hours?.isActive) return [];

  const duration = config.slotDurationMinutes;
  const end = timeToMinutes(hours.endTime);
  const slots: Slot[] = [];
  for (let start = timeToMinutes(hours.startTime); start + duration <= end; start += duration) {
    const startAt = businessDateTimeToInstant(date, minutesToTime(start));
    slots.push({ startAt, endAt: new Date(startAt.getTime() + duration * 60_000) });
  }
  return slots;
}

/** RN-05: slots that start after `now` and do not overlap a CONFIRMED appointment. */
export function getAvailableSlots(input: {
  date: string;
  config: ScheduleConfig;
  isBlocked: boolean;
  appointments: readonly OccupyingAppointment[];
  now: Date;
}): Slot[] {
  return generateDaySlots(input).filter(
    (slot) => slot.startAt > input.now && isFree(slot, input.appointments),
  );
}

export type SlotCheck =
  { result: 'OK'; slot: Slot } | { result: 'IN_PAST' | 'NOT_AVAILABLE' | 'BOOKED' };

/**
 * RN-06: validates a requested start, in this order: past -> not the exact start of a generated
 * slot (closed, blocked, outside working hours, misaligned) -> overlaps a CONFIRMED appointment.
 * `isBlocked` refers to the business date of `startAt`.
 */
export function checkSlot(input: {
  startAt: Date;
  config: ScheduleConfig;
  isBlocked: boolean;
  appointments: readonly OccupyingAppointment[];
  now: Date;
}): SlotCheck {
  const { startAt, config, isBlocked, appointments, now } = input;
  if (startAt <= now) return { result: 'IN_PAST' };

  const slot = generateDaySlots({ date: toBusinessDate(startAt), config, isBlocked }).find(
    (candidate) => candidate.startAt.getTime() === startAt.getTime(),
  );
  if (!slot) return { result: 'NOT_AVAILABLE' };
  if (!isFree(slot, appointments)) return { result: 'BOOKED' };
  return { result: 'OK', slot };
}

/**
 * State of each day of a "YYYY-MM" month. Precedence: PAST > BLOCKED > CLOSED > AVAILABLE/NO_SLOTS.
 * "Today" is the business date of `now`; today with every slot already gone is NO_SLOTS.
 */
export function getMonthDayStatuses(input: {
  month: string;
  config: ScheduleConfig;
  blockedDates: ReadonlySet<string>;
  appointments: readonly OccupyingAppointment[];
  now: Date;
}): { date: string; status: DayAvailabilityStatus }[] {
  const { month, config, blockedDates, appointments, now } = input;
  const today = toBusinessDate(now);

  return getMonthDates(month).map((date) => {
    let status: DayAvailabilityStatus;
    if (date < today) status = DayAvailabilityStatus.PAST;
    else if (blockedDates.has(date)) status = DayAvailabilityStatus.BLOCKED;
    else if (!isWeekdayActive(config, date)) status = DayAvailabilityStatus.CLOSED;
    else {
      const free = getAvailableSlots({ date, config, isBlocked: false, appointments, now });
      status = free.length > 0 ? DayAvailabilityStatus.AVAILABLE : DayAvailabilityStatus.NO_SLOTS;
    }
    return { date, status };
  });
}
