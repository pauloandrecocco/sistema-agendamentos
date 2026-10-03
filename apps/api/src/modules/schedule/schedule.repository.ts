import type { ScheduleConfig } from '@agenda/shared';
import type { DbClient } from '../../lib/prisma.js';
import { dbDateToString, stringToDbDate } from '../../lib/time.js';

export interface ScheduleRepository {
  /** Slot duration + the 7 working hours rows, ordered by weekday. Read on every operation (PRD 7.4). */
  getScheduleConfig(): Promise<ScheduleConfig>;
  /** Upserts the duration and the 7 working hours rows. Run it inside a transaction (atomic). */
  saveScheduleConfig(config: ScheduleConfig): Promise<void>;
}

export interface BlockedDateRepository {
  exists(date: string): Promise<boolean>;
  /** Blocked dates ("YYYY-MM-DD") between `from` and `to`, inclusive. */
  findInRange(from: string, to: string): Promise<string[]>;
  /** Blocks the dates; already blocked ones are left untouched (idempotent). */
  addMany(dates: string[]): Promise<void>;
  /** Unblocks the dates; dates that are not blocked are ignored. */
  removeMany(dates: string[]): Promise<void>;
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

  async saveScheduleConfig(config: ScheduleConfig): Promise<void> {
    const { slotDurationMinutes } = config;
    await this.db.scheduleSettings.upsert({
      where: { id: 1 },
      create: { id: 1, slotDurationMinutes },
      update: { slotDurationMinutes },
    });
    for (const { weekday, isActive, startTime, endTime } of config.workingHours) {
      await this.db.workingHour.upsert({
        where: { weekday },
        create: { weekday, isActive, startTime, endTime },
        update: { isActive, startTime, endTime },
      });
    }
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

  async addMany(dates: string[]): Promise<void> {
    await this.db.blockedDate.createMany({
      data: dates.map((date) => ({ date: stringToDbDate(date) })),
      skipDuplicates: true,
    });
  }

  async removeMany(dates: string[]): Promise<void> {
    await this.db.blockedDate.deleteMany({ where: { date: { in: dates.map(stringToDbDate) } } });
  }
}
