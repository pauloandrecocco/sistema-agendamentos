import { CancelledBy, DisplayStatus, getDisplayStatus, type AppointmentDto } from '@agenda/shared';
import { useNow } from './use-now';

/** Who is looking at the appointment: changes how a cancellation is described (RN-09). */
export type StatusViewer = 'CLIENT' | 'ADMIN';

const CANCELLED_LABELS: Record<StatusViewer, Record<CancelledBy, string>> = {
  CLIENT: {
    [CancelledBy.CLIENT]: 'Cancelado por você',
    [CancelledBy.ADMIN]: 'Cancelado pelo estabelecimento',
  },
  ADMIN: {
    [CancelledBy.CLIENT]: 'Cancelado pelo cliente',
    [CancelledBy.ADMIN]: 'Cancelado pelo estabelecimento',
  },
};

/**
 * Display status as of now (RN-09), with the same shared getDisplayStatus the API uses. The
 * `displayStatus` sent by the API is frozen at fetch time: an appointment that starts while the
 * screen is open must turn "Concluído" and lose its "Cancelar" button.
 */
export function useDisplayStatus(appointment: Pick<AppointmentDto, 'status' | 'startAt'>) {
  const now = useNow();
  return getDisplayStatus(
    { status: appointment.status, startAt: new Date(appointment.startAt) },
    now,
  );
}

/** UI label of a display status. */
export function getStatusLabel(
  appointment: Pick<AppointmentDto, 'displayStatus' | 'cancelledBy'>,
  viewer: StatusViewer,
): string {
  switch (appointment.displayStatus) {
    case DisplayStatus.CONFIRMED:
      return 'Confirmado';
    case DisplayStatus.COMPLETED:
      return 'Concluído';
    case DisplayStatus.CANCELLED:
      return appointment.cancelledBy
        ? CANCELLED_LABELS[viewer][appointment.cancelledBy]
        : 'Cancelado';
  }
}
