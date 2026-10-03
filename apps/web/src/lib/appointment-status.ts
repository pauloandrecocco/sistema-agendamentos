import { CancelledBy, DisplayStatus, type AppointmentDto } from '@agenda/shared';

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

/** UI label of the display status (computed by the API with the shared getDisplayStatus). */
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
