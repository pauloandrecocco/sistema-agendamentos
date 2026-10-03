import {
  getBusinessDayBounds,
  getMonthDates,
  type AvailabilityCalendarResponse,
  type AvailabilityResponse,
} from '@agenda/shared';
import type { Clock } from '../../lib/clock.js';
import type { AppointmentRepository } from '../appointments/appointments.repository.js';
import type { BlockedDateRepository, ScheduleRepository } from '../schedule/schedule.repository.js';
import { getAvailableSlots, getMonthDayStatuses } from './availability.engine.js';

type Deps = {
  schedule: ScheduleRepository;
  blockedDates: BlockedDateRepository;
  appointments: AppointmentRepository;
  clock: Clock;
};

/** Read-only: loads the data and delegates every rule to the availability engine. */
export class AvailabilityService {
  constructor(private readonly deps: Deps) {}

  async getCalendar(month: string): Promise<AvailabilityCalendarResponse> {
    const dates = getMonthDates(month);
    const first = dates[0]!;
    const last = dates.at(-1)!;
    const [config, blockedDates, appointments] = await Promise.all([
      this.deps.schedule.getScheduleConfig(),
      this.deps.blockedDates.findInRange(first, last),
      this.deps.appointments.findConfirmedOverlapping(
        getBusinessDayBounds(first).start,
        getBusinessDayBounds(last).end,
      ),
    ]);

    const days = getMonthDayStatuses({
      month,
      config,
      blockedDates: new Set(blockedDates),
      appointments,
      now: this.deps.clock(),
    });
    return { month, days };
  }

  /** Free slots of a day; a past day simply has none. */
  async getDay(date: string): Promise<AvailabilityResponse> {
    const { start, end } = getBusinessDayBounds(date);
    const [config, isBlocked, appointments] = await Promise.all([
      this.deps.schedule.getScheduleConfig(),
      this.deps.blockedDates.exists(date),
      this.deps.appointments.findConfirmedOverlapping(start, end),
    ]);

    const slots = getAvailableSlots({
      date,
      config,
      isBlocked,
      appointments,
      now: this.deps.clock(),
    });
    return {
      date,
      slotDurationMinutes: config.slotDurationMinutes,
      slots: slots.map((slot) => ({
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
      })),
    };
  }
}
