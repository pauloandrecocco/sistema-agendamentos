import { AppointmentScope, AppointmentStatus, type CancelledBy } from '@agenda/shared';
import { randomUUID } from 'node:crypto';
import type {
  AppointmentRecord,
  AppointmentRepository,
  CreateAppointmentRecord,
} from '../../src/modules/appointments/appointments.repository.js';
import { createOverlapViolationError } from './prisma-error.js';

const byStart = (a: AppointmentRecord, b: AppointmentRecord) =>
  a.startAt.getTime() - b.startAt.getTime();

export class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly appointments: AppointmentRecord[] = [];
  /** When set, the next create() fails as if the exclusion constraint had been violated. */
  simulateOverlapOnNextCreate = false;

  findConfirmedOverlapping(start: Date, end: Date): Promise<AppointmentRecord[]> {
    return Promise.resolve(
      this.appointments
        .filter(
          (appointment) =>
            appointment.status === AppointmentStatus.CONFIRMED &&
            appointment.startAt < end &&
            appointment.endAt > start,
        )
        .sort(byStart)
        .map((appointment) => ({ ...appointment })),
    );
  }

  findById(id: string): Promise<AppointmentRecord | null> {
    const appointment = this.appointments.find((candidate) => candidate.id === id);
    return Promise.resolve(appointment ? { ...appointment } : null);
  }

  /** Mirrors the appointments_no_overlap exclusion constraint. */
  async create(data: CreateAppointmentRecord): Promise<AppointmentRecord> {
    const overlapping = await this.findConfirmedOverlapping(data.startAt, data.endAt);
    if (this.simulateOverlapOnNextCreate || overlapping.length > 0) {
      this.simulateOverlapOnNextCreate = false;
      throw createOverlapViolationError();
    }
    const appointment: AppointmentRecord = {
      id: randomUUID(),
      ...data,
      status: AppointmentStatus.CONFIRMED,
      cancelledBy: null,
      cancelledAt: null,
      createdAt: new Date(),
    };
    this.appointments.push(appointment);
    return { ...appointment };
  }

  listByClient(clientId: string, scope: AppointmentScope, now: Date): Promise<AppointmentRecord[]> {
    const isUpcoming = (appointment: AppointmentRecord) =>
      appointment.status === AppointmentStatus.CONFIRMED && appointment.startAt > now;
    const items = this.appointments
      .filter(
        (appointment) =>
          appointment.clientId === clientId &&
          isUpcoming(appointment) === (scope === AppointmentScope.UPCOMING),
      )
      .sort(byStart);
    if (scope === AppointmentScope.HISTORY) items.reverse();
    return Promise.resolve(items.map((appointment) => ({ ...appointment })));
  }

  /** Mirrors UPDATE ... WHERE id = ? AND status = 'CONFIRMED'. */
  cancelIfConfirmed(
    id: string,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord | null> {
    const appointment = this.appointments.find(
      (candidate) => candidate.id === id && candidate.status === AppointmentStatus.CONFIRMED,
    );
    if (!appointment) return Promise.resolve(null);
    Object.assign(appointment, { status: AppointmentStatus.CANCELLED, cancelledBy, cancelledAt });
    return Promise.resolve({ ...appointment });
  }
}
