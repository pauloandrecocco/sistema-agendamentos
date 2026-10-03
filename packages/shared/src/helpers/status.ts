import { AppointmentStatus, DisplayStatus } from '../enums.js';

/**
 * Single source of the displayed status (RN-09). The criterion is the start of the appointment:
 * a CONFIRMED appointment that has started (startAt <= now) is shown as COMPLETED.
 */
export function getDisplayStatus(
  appointment: { status: AppointmentStatus; startAt: Date },
  now: Date,
): DisplayStatus {
  if (appointment.status === AppointmentStatus.CANCELLED) return DisplayStatus.CANCELLED;
  return appointment.startAt.getTime() <= now.getTime()
    ? DisplayStatus.COMPLETED
    : DisplayStatus.CONFIRMED;
}
