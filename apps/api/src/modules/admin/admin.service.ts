import {
  INVALID_PERIOD_MESSAGE,
  addDaysToDate,
  getBusinessDayBounds,
  getMonthDates,
  toBusinessDate,
  type AdminAppointmentListResponse,
  type AdminAppointmentsQuery,
  type AdminCalendarResponse,
  type AdminSummaryResponse,
} from '@agenda/shared';
import type { Clock } from '../../lib/clock.js';
import { ValidationError } from '../../lib/errors.js';
import type { AppointmentRepository } from '../appointments/appointments.repository.js';
import { toAppointmentDto } from '../appointments/appointments.service.js';
import { isWeekdayActive } from '../availability/availability.engine.js';
import type { BlockedDateRepository, ScheduleRepository } from '../schedule/schedule.repository.js';

type Deps = {
  schedule: ScheduleRepository;
  blockedDates: BlockedDateRepository;
  appointments: AppointmentRepository;
  clock: Clock;
};

/**
 * Admin panel queries. Every "per day" grouping uses the business date of `startAt` (RN-15):
 * 22:00 in São Paulo is 01:00Z of the next day, but belongs to the local day.
 */
export class AdminService {
  constructor(private readonly deps: Deps) {}

  /** CONFIRMED (not cancelled, including started ones) appointments per business date, from `first` to `last`. */
  private async countConfirmedByDate(first: string, last: string): Promise<Map<string, number>> {
    const appointments = await this.deps.appointments.findConfirmedOverlapping(
      getBusinessDayBounds(first).start,
      getBusinessDayBounds(last).end,
    );
    const counts = new Map<string, number>();
    for (const { startAt } of appointments) {
      const date = toBusinessDate(startAt);
      // Overlap may bring one that started the day before and ends inside the range.
      if (date < first || date > last) continue;
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
    return counts;
  }

  /** RF-07: today (including started ones) and the next 7 days (tomorrow to today + 7). */
  async getSummary(): Promise<AdminSummaryResponse> {
    const today = toBusinessDate(this.deps.clock());
    const counts = await this.countConfirmedByDate(today, addDaysToDate(today, 7));
    let next7Days = 0;
    for (let offset = 1; offset <= 7; offset++) {
      next7Days += counts.get(addDaysToDate(today, offset)) ?? 0;
    }
    return { today: counts.get(today) ?? 0, next7Days };
  }

  /** RF-08: per day of the month, the count of CONFIRMED appointments and the day flags. */
  async getCalendar(month: string): Promise<AdminCalendarResponse> {
    const dates = getMonthDates(month);
    const first = dates[0]!;
    const last = dates.at(-1)!;
    const [config, blockedDates, counts] = await Promise.all([
      this.deps.schedule.getScheduleConfig(),
      this.deps.blockedDates.findInRange(first, last),
      this.countConfirmedByDate(first, last),
    ]);
    const blocked = new Set(blockedDates);
    const today = toBusinessDate(this.deps.clock());

    return {
      month,
      days: dates.map((date) => ({
        date,
        appointmentsCount: counts.get(date) ?? 0,
        isClosed: !isWeekdayActive(config, date),
        isBlocked: blocked.has(date),
        isPast: date < today,
      })),
    };
  }

  /** RF-09: `from`/`to` are inclusive business dates; `from` defaults to today. */
  async listAppointments(query: AdminAppointmentsQuery): Promise<AdminAppointmentListResponse> {
    const now = this.deps.clock();
    const from = query.from ?? toBusinessDate(now);
    // The schema compares only when both are sent: `to` before the default `from` is the same error.
    if (query.to && from > query.to) {
      throw new ValidationError('Dados inválidos.', { to: [INVALID_PERIOD_MESSAGE] });
    }
    const { items, total } = await this.deps.appointments.listForAdmin({
      start: getBusinessDayBounds(from).start,
      ...(query.to && { end: getBusinessDayBounds(query.to).end }),
      ...(query.status && { status: query.status }),
      ...(query.search && { search: query.search }),
      now,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      items: items.map((appointment) => ({
        ...toAppointmentDto(appointment, now),
        client: appointment.client,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
