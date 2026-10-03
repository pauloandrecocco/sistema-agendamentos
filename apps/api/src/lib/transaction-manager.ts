import type { PrismaClient } from '../generated/prisma/client.js';
import {
  PrismaAppointmentRepository,
  type AppointmentRepository,
} from '../modules/appointments/appointments.repository.js';
import {
  PrismaBlockedDateRepository,
  PrismaScheduleRepository,
  type BlockedDateRepository,
  type ScheduleRepository,
} from '../modules/schedule/schedule.repository.js';
import type { DbClient } from './prisma.js';

/** Repositories bound to the running transaction. */
export type TxRepositories = {
  schedule: ScheduleRepository;
  blockedDates: BlockedDateRepository;
  appointments: AppointmentRepository;
};

export interface TransactionManager {
  /** Runs `fn` in a transaction that holds the schedule advisory lock (RN-13). */
  run<T>(fn: (repos: TxRepositories) => Promise<T>): Promise<T>;
}

/**
 * Key of the transaction-level advisory lock shared by booking and blocking dates (RN-13): they
 * run one at a time, so a booking can never be completed on a day that is being blocked.
 */
export const SCHEDULE_LOCK_KEY = 815_001n;

export function createRepositories(db: DbClient): TxRepositories {
  return {
    schedule: new PrismaScheduleRepository(db),
    blockedDates: new PrismaBlockedDateRepository(db),
    appointments: new PrismaAppointmentRepository(db),
  };
}

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(fn: (repos: TxRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw, not $queryRaw: the function returns void, which the Prisma 7 adapter cannot
      // deserialize. The lock is released automatically at commit/rollback.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SCHEDULE_LOCK_KEY})`;
      return fn(createRepositories(tx));
    });
  }
}
