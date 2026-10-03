import { AppointmentScope, AppointmentStatus, type CancelledBy } from '@agenda/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { DbClient } from '../../lib/prisma.js';

export type AppointmentRecord = {
  id: string;
  clientId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  cancelledBy: CancelledBy | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

export type CreateAppointmentRecord = { clientId: string; startAt: Date; endAt: Date };

export interface AppointmentRepository {
  /** CONFIRMED appointments overlapping [start, end). */
  findConfirmedOverlapping(start: Date, end: Date): Promise<AppointmentRecord[]>;
  findById(id: string): Promise<AppointmentRecord | null>;
  /**
   * Creates a CONFIRMED appointment. An overlap with another CONFIRMED one is rejected by the
   * exclusion constraint (the error is converted to 409 in lib/prisma-errors.ts).
   */
  create(data: CreateAppointmentRecord): Promise<AppointmentRecord>;
  /** upcoming: CONFIRMED with startAt > now, ascending. history: everything else, descending. */
  listByClient(clientId: string, scope: AppointmentScope, now: Date): Promise<AppointmentRecord[]>;
  /**
   * Conditional update (WHERE id = ? AND status = 'CONFIRMED'), so concurrent cancellations never
   * overwrite each other. Returns null when no row was updated.
   */
  cancelIfConfirmed(
    id: string,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord | null>;
}

const appointmentSelect = {
  id: true,
  clientId: true,
  startAt: true,
  endAt: true,
  status: true,
  cancelledBy: true,
  cancelledAt: true,
  createdAt: true,
} as const;

export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly db: DbClient) {}

  findConfirmedOverlapping(start: Date, end: Date): Promise<AppointmentRecord[]> {
    return this.db.appointment.findMany({
      where: { status: AppointmentStatus.CONFIRMED, startAt: { lt: end }, endAt: { gt: start } },
      orderBy: { startAt: 'asc' },
      select: appointmentSelect,
    });
  }

  findById(id: string): Promise<AppointmentRecord | null> {
    return this.db.appointment.findUnique({ where: { id }, select: appointmentSelect });
  }

  create(data: CreateAppointmentRecord): Promise<AppointmentRecord> {
    return this.db.appointment.create({
      data: { ...data, status: AppointmentStatus.CONFIRMED },
      select: appointmentSelect,
    });
  }

  listByClient(clientId: string, scope: AppointmentScope, now: Date): Promise<AppointmentRecord[]> {
    const upcoming: Prisma.AppointmentWhereInput = {
      status: AppointmentStatus.CONFIRMED,
      startAt: { gt: now },
    };
    return this.db.appointment.findMany({
      where:
        scope === AppointmentScope.UPCOMING
          ? { clientId, ...upcoming }
          : { clientId, NOT: upcoming },
      orderBy: { startAt: scope === AppointmentScope.UPCOMING ? 'asc' : 'desc' },
      select: appointmentSelect,
    });
  }

  async cancelIfConfirmed(
    id: string,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord | null> {
    const { count } = await this.db.appointment.updateMany({
      where: { id, status: AppointmentStatus.CONFIRMED },
      data: { status: AppointmentStatus.CANCELLED, cancelledBy, cancelledAt },
    });
    return count === 0 ? null : this.findById(id);
  }
}
