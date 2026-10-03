import {
  AppointmentScope,
  AppointmentStatus,
  DisplayStatus,
  normalizePhone,
  type AdminClient,
  type CancelledBy,
} from '@agenda/shared';
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

export type AppointmentWithClient = AppointmentRecord & { client: AdminClient };

/** Half-open instant range [start, end). */
export type TimeRange = { start: Date; end: Date };

export type AdminAppointmentFilter = {
  /** startAt >= start (and < end, when given). */
  start: Date;
  end?: Date;
  /** Display status (RN-09), translated with `now`. */
  status?: DisplayStatus;
  /** Contains, case-insensitive, in the client's name, e-mail or phone. */
  search?: string;
  now: Date;
  skip: number;
  take: number;
};

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
  /** Admin list: filtered, ordered by startAt ascending, paginated; `total` ignores pagination. */
  listForAdmin(
    filter: AdminAppointmentFilter,
  ): Promise<{ items: AppointmentWithClient[]; total: number }>;
  /**
   * Cancels, in one conditional update, every CONFIRMED appointment starting inside one of
   * `ranges` and after `after` (used when blocking dates, RN-11). Returns the cancelled ones.
   */
  cancelConfirmedStartingIn(
    ranges: TimeRange[],
    after: Date,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord[]>;
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

  async listForAdmin(
    filter: AdminAppointmentFilter,
  ): Promise<{ items: AppointmentWithClient[]; total: number }> {
    const where = adminWhere(filter);
    const [items, total] = await Promise.all([
      this.db.appointment.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip: filter.skip,
        take: filter.take,
        select: {
          ...appointmentSelect,
          client: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
      this.db.appointment.count({ where }),
    ]);
    return { items, total };
  }

  cancelConfirmedStartingIn(
    ranges: TimeRange[],
    after: Date,
    cancelledBy: CancelledBy,
    cancelledAt: Date,
  ): Promise<AppointmentRecord[]> {
    // Single UPDATE ... WHERE status = 'CONFIRMED' ... RETURNING: a concurrent client cancellation
    // is never overwritten, and only the rows actually changed are returned.
    return this.db.appointment.updateManyAndReturn({
      where: {
        status: AppointmentStatus.CONFIRMED,
        startAt: { gt: after },
        OR: ranges.map((range) => ({ startAt: { gte: range.start, lt: range.end } })),
      },
      data: { status: AppointmentStatus.CANCELLED, cancelledBy, cancelledAt },
      select: appointmentSelect,
    });
  }
}

function adminWhere(filter: AdminAppointmentFilter): Prisma.AppointmentWhereInput {
  const conditions: Prisma.AppointmentWhereInput[] = [
    { startAt: { gte: filter.start, ...(filter.end && { lt: filter.end }) } },
  ];

  // RN-09: COMPLETED is a CONFIRMED appointment that has started.
  switch (filter.status) {
    case DisplayStatus.CONFIRMED:
      conditions.push({ status: AppointmentStatus.CONFIRMED, startAt: { gt: filter.now } });
      break;
    case DisplayStatus.COMPLETED:
      conditions.push({ status: AppointmentStatus.CONFIRMED, startAt: { lte: filter.now } });
      break;
    case DisplayStatus.CANCELLED:
      conditions.push({ status: AppointmentStatus.CANCELLED });
      break;
  }

  if (filter.search) {
    const { search } = filter;
    // The phone is stored as digits only, so it is compared with the digits of the term; a term
    // without digits would be `contains ""`, which matches every phone.
    const digits = normalizePhone(search);
    conditions.push({
      client: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      },
    });
  }

  return { AND: conditions };
}
