import { AppointmentStatus, type CancelledBy } from '@agenda/shared';
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

export interface AppointmentRepository {
  /** CONFIRMED appointments overlapping [start, end). */
  findConfirmedOverlapping(start: Date, end: Date): Promise<AppointmentRecord[]>;
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
}
