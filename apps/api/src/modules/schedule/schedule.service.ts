import {
  CancelledBy,
  getBusinessDayBounds,
  toBusinessDate,
  type BlockDatesResponse,
  type ScheduleConfig,
  type UnblockDatesResponse,
} from '@agenda/shared';
import type { Clock } from '../../lib/clock.js';
import { BusinessRuleError } from '../../lib/errors.js';
import type { TransactionManager } from '../../lib/transaction-manager.js';
import { toAppointmentDto } from '../appointments/appointments.service.js';
import type { BlockedDateRepository, ScheduleRepository } from './schedule.repository.js';

type Deps = {
  transactions: TransactionManager;
  schedule: ScheduleRepository;
  blockedDates: BlockedDateRepository;
  clock: Clock;
};

/** Dates before today (business timezone) cannot be blocked or unblocked (RN-11, RN-12). */
function assertNotPast(dates: string[], now: Date, action: 'bloquear' | 'desbloquear') {
  const today = toBusinessDate(now);
  const past = dates.filter((date) => date < today);
  if (past.length > 0) {
    throw new BusinessRuleError('INVALID_DATE', `Não é possível ${action} datas passadas.`, {
      dates: past,
    });
  }
}

export class ScheduleService {
  constructor(private readonly deps: Deps) {}

  getConfig(): Promise<ScheduleConfig> {
    return this.deps.schedule.getScheduleConfig();
  }

  /**
   * RN-10: saves the duration and weekly hours atomically; existing appointments are never touched
   * (future slots still respect overlap with them, RN-05).
   */
  updateConfig(config: ScheduleConfig): Promise<ScheduleConfig> {
    return this.deps.transactions.run(async (repos) => {
      await repos.schedule.saveScheduleConfig(config);
      return repos.schedule.getScheduleConfig();
    });
  }

  /**
   * RN-11 / RN-13: inside the advisory-locked transaction (the same one bookings use), blocks the
   * dates and cancels the CONFIRMED appointments of those dates that have not started yet.
   * Idempotent: blocking again cancels nothing new.
   */
  async block(dates: string[]): Promise<BlockDatesResponse> {
    const { cancelled, now } = await this.deps.transactions.run(async (repos) => {
      // Read after the lock, like the booking: both see the same "now" ordering.
      const now = this.deps.clock();
      assertNotPast(dates, now, 'bloquear');
      await repos.blockedDates.addMany(dates);
      const cancelled = await repos.appointments.cancelConfirmedStartingIn(
        dates.map((date) => getBusinessDayBounds(date)),
        now,
        CancelledBy.ADMIN,
        now,
      );
      return { cancelled, now };
    });
    return {
      blockedDates: dates,
      cancelledAppointments: cancelled.map((appointment) => toAppointmentDto(appointment, now)),
    };
  }

  /** RN-12: removes the blocks; cancelled appointments are not restored. */
  async unblock(dates: string[]): Promise<UnblockDatesResponse> {
    assertNotPast(dates, this.deps.clock(), 'desbloquear');
    await this.deps.blockedDates.removeMany(dates);
    return { unblockedDates: dates };
  }
}
