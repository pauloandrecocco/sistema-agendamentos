import {
  AppointmentScope,
  AppointmentStatus,
  DisplayStatus,
  normalizePhone,
  type AdminClient,
  type CancelledBy,
} from '@agenda/shared';
import { randomUUID } from 'node:crypto';
import type {
  AdminAppointmentFilter,
  AppointmentRecord,
  AppointmentRepository,
  AppointmentWithClient,
  CreateAppointmentRecord,
  TimeRange,
} from '../../src/modules/appointments/appointments.repository.js';
import type { InMemoryUserRepository } from './in-memory-user.repository.js';
import { createOverlapViolationError } from './prisma-error.js';

const byStart = (a: AppointmentRecord, b: AppointmentRecord) =>
  a.startAt.getTime() - b.startAt.getTime();

export class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly appointments: AppointmentRecord[] = [];
  /** When set, the next create() fails as if the exclusion constraint had been violated. */
  simulateOverlapOnNextCreate = false;

  /** Users play the role of the `client` relation in the admin list. */
  constructor(private readonly users?: InMemoryUserRepository) {}

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

  /** Mirrors the Prisma query: RN-09 status translation, search on the client, startAt ascending. */
  listForAdmin(
    filter: AdminAppointmentFilter,
  ): Promise<{ items: AppointmentWithClient[]; total: number }> {
    const matchesStatus = (appointment: AppointmentRecord) => {
      const confirmed = appointment.status === AppointmentStatus.CONFIRMED;
      switch (filter.status) {
        case DisplayStatus.CONFIRMED:
          return confirmed && appointment.startAt > filter.now;
        case DisplayStatus.COMPLETED:
          return confirmed && appointment.startAt <= filter.now;
        case DisplayStatus.CANCELLED:
          return !confirmed;
        default:
          return true;
      }
    };
    const matchesSearch = (client: AdminClient) => {
      if (!filter.search) return true;
      const term = filter.search.toLowerCase();
      const digits = normalizePhone(filter.search);
      return (
        client.name.toLowerCase().includes(term) ||
        client.email.toLowerCase().includes(term) ||
        (digits !== '' && (client.phone ?? '').includes(digits))
      );
    };

    const matching = this.appointments
      .filter(
        (appointment) =>
          appointment.startAt >= filter.start &&
          (!filter.end || appointment.startAt < filter.end) &&
          matchesStatus(appointment),
      )
      .map((appointment) => ({ ...appointment, client: this.getClient(appointment.clientId) }))
      .filter((appointment) => matchesSearch(appointment.client))
      .sort((a, b) => byStart(a, b) || a.id.localeCompare(b.id));
    return Promise.resolve({
      items: matching.slice(filter.skip, filter.skip + filter.take),
      total: matching.length,
    });
  }

  /** Mirrors the single conditional UPDATE ... RETURNING. */
  cancelConfirmedStartingIn(
    ranges: TimeRange[],
    after: Date,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord[]> {
    const cancelled = this.appointments.filter(
      (appointment) =>
        appointment.status === AppointmentStatus.CONFIRMED &&
        appointment.startAt > after &&
        ranges.some(
          (range) => appointment.startAt >= range.start && appointment.startAt < range.end,
        ),
    );
    for (const appointment of cancelled) {
      Object.assign(appointment, { status: AppointmentStatus.CANCELLED, cancelledBy, cancelledAt });
    }
    return Promise.resolve(cancelled.map((appointment) => ({ ...appointment })));
  }

  /** Like the foreign key: every appointment of an admin list must belong to a known user. */
  private getClient(clientId: string): AdminClient {
    const user = this.users?.users.find((candidate) => candidate.id === clientId);
    if (!user) throw new Error(`Unknown client ${clientId}: add it to the user repository`);
    return { id: user.id, name: user.name, email: user.email, phone: user.phone };
  }
}
