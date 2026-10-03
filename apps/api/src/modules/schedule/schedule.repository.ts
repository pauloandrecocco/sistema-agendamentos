import type { ScheduleConfig } from '@agenda/shared';
import type { DbClient } from '../../lib/prisma.js';
import { dbDateToString, stringToDbDate } from '../../lib/time.js';

export interface ScheduleRepository {
  /** Slot duration + the 7 working hours rows, ordered by weekday. Read on every operation (PRD 7.4). */
  getScheduleConfig(): Promise<ScheduleConfig>;
}

export interface BlockedDateRepository {
  exists(date: string): Promise<boolean>;
  /** Blocked dates ("YYYY-MM-DD") between `from` and `to`, inclusive. */
  findInRange(from: string, to: string): Promise<string[]>;
}

export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly db: DbClient) {}

  async getScheduleConfig(): Promise<ScheduleConfig> {
    const [settings, workingHours] = await Promise.all([
      this.db.scheduleSettings.findUnique({ where: { id: 1 } }),
      this.db.workingHour.findMany({ orderBy: { weekday: 'asc' } }),
    ]);
    if (!settings || workingHours.length !== 7) {
      throw new Error('Schedule configuration is missing: run the seed (npm run db:seed -w api).');
    }
    return {
      slotDurationMinutes: settings.slotDurationMinutes,
      workingHours: workingHours.map(({ weekday, isActive, startTime, endTime }) => ({
        weekday,
        isActive,
        startTime,
        endTime,
      })),
    };
  }
}

export class PrismaBlockedDateRepository implements BlockedDateRepository {
  constructor(private readonly db: DbClient) {}

  async exists(date: string): Promise<boolean> {
    const row = await this.db.blockedDate.findUnique({ where: { date: stringToDbDate(date) } });
    return row !== null;
  }

  async findInRange(from: string, to: string): Promise<string[]> {
    const rows = await this.db.blockedDate.findMany({
      where: { date: { gte: stringToDbDate(from), lte: stringToDbDate(to) } },
      orderBy: { date: 'asc' },
    });
    return rows.map((row) => dbDateToString(row.date));
  }
}
