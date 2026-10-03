import { AppointmentStatus } from '@agenda/shared';
import type {
  AppointmentRecord,
  AppointmentRepository,
} from '../../src/modules/appointments/appointments.repository.js';

export class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly appointments: AppointmentRecord[] = [];

  findConfirmedOverlapping(start: Date, end: Date): Promise<AppointmentRecord[]> {
    return Promise.resolve(
      this.appointments
        .filter(
          (appointment) =>
            appointment.status === AppointmentStatus.CONFIRMED &&
            appointment.startAt < end &&
            appointment.endAt > start,
        )
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((appointment) => ({ ...appointment })),
    );
  }
}
