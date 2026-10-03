import {
  AppointmentStatus,
  CancelledBy,
  Role,
  getDisplayStatus,
  toBusinessDate,
  type AppointmentDto,
  type AppointmentScope,
} from '@agenda/shared';
import type { Clock } from '../../lib/clock.js';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  SLOT_ALREADY_BOOKED_MESSAGE,
} from '../../lib/errors.js';
import type { AuthContext } from '../../lib/jwt.js';
import type { TransactionManager } from '../../lib/transaction-manager.js';
import { checkSlot } from '../availability/availability.engine.js';
import type { AppointmentRecord, AppointmentRepository } from './appointments.repository.js';

type Deps = {
  transactions: TransactionManager;
  appointments: AppointmentRepository;
  clock: Clock;
};

const NOT_FOUND_MESSAGE = 'Agendamento não encontrado.';

export function toAppointmentDto(appointment: AppointmentRecord, now: Date): AppointmentDto {
  return {
    id: appointment.id,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
    displayStatus: getDisplayStatus(appointment, now),
    cancelledBy: appointment.cancelledBy,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    createdAt: appointment.createdAt.toISOString(),
  };
}

export class AppointmentsService {
  constructor(private readonly deps: Deps) {}

  /**
   * RN-06: inside the advisory-locked transaction, validates `startAt` with the same engine that
   * lists availability. The exclusion constraint stays as the final guarantee (RN-07).
   */
  async create(clientId: string, startAt: Date): Promise<AppointmentDto> {
    const { appointment, now } = await this.deps.transactions.run(async (repos) => {
      // Read after the advisory lock is acquired, so a slot that started while this request waited
      // for the lock is rejected as past.
      const now = this.deps.clock();
      const config = await repos.schedule.getScheduleConfig();
      const isBlocked = await repos.blockedDates.exists(toBusinessDate(startAt));
      const requestedEnd = new Date(startAt.getTime() + config.slotDurationMinutes * 60_000);
      const appointments = await repos.appointments.findConfirmedOverlapping(startAt, requestedEnd);

      const check = checkSlot({ startAt, config, isBlocked, appointments, now });
      switch (check.result) {
        case 'IN_PAST':
          throw new BusinessRuleError(
            'SLOT_IN_PAST',
            'Não é possível agendar em um horário que já passou.',
          );
        case 'NOT_AVAILABLE':
          throw new BusinessRuleError(
            'SLOT_NOT_AVAILABLE',
            'Este horário não está disponível para agendamento.',
          );
        case 'BOOKED':
          throw new ConflictError('SLOT_ALREADY_BOOKED', SLOT_ALREADY_BOOKED_MESSAGE);
        case 'OK':
          // endAt "freezes" the current duration in the appointment.
          return {
            appointment: await repos.appointments.create({
              clientId,
              startAt: check.slot.startAt,
              endAt: check.slot.endAt,
            }),
            now,
          };
      }
    });
    return toAppointmentDto(appointment, now);
  }

  async listMine(clientId: string, scope: AppointmentScope): Promise<AppointmentDto[]> {
    const now = this.deps.clock();
    const appointments = await this.deps.appointments.listByClient(clientId, scope, now);
    return appointments.map((appointment) => toAppointmentDto(appointment, now));
  }

  /**
   * RN-08. A client only sees their own appointments (another client's is a 404). The update is
   * conditional on status = CONFIRMED: if a concurrent cancellation won, it is reported as
   * already cancelled instead of being overwritten.
   */
  async cancel(id: string, actor: AuthContext): Promise<AppointmentDto> {
    const now = this.deps.clock();
    const appointment = await this.deps.appointments.findById(id);
    if (!appointment || (actor.role === Role.CLIENT && appointment.clientId !== actor.userId)) {
      throw new NotFoundError(NOT_FOUND_MESSAGE);
    }
    if (appointment.status === AppointmentStatus.CANCELLED) throw alreadyCancelled();
    if (appointment.startAt <= now) {
      throw new BusinessRuleError(
        'APPOINTMENT_ALREADY_STARTED',
        'Não é possível cancelar um agendamento que já começou.',
      );
    }

    const cancelledBy = actor.role === Role.ADMIN ? CancelledBy.ADMIN : CancelledBy.CLIENT;
    const cancelled = await this.deps.appointments.cancelIfConfirmed(id, cancelledBy, now);
    if (!cancelled) throw alreadyCancelled();
    return toAppointmentDto(cancelled, now);
  }
}

function alreadyCancelled() {
  return new BusinessRuleError(
    'APPOINTMENT_ALREADY_CANCELLED',
    'Este agendamento já foi cancelado.',
  );
}
