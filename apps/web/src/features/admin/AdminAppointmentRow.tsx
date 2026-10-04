import { DisplayStatus, type AdminAppointmentDto } from '@agenda/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useDisplayStatus } from '@/lib/appointment-status';
import { formatPhone, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type AdminAppointmentRowProps = {
  appointment: AdminAppointmentDto;
  onCancel: (appointment: AdminAppointmentDto) => void;
};

/** One appointment in the admin lists (RF-08, RF-09). Cancelled ones are dimmed. */
export function AdminAppointmentRow({ appointment, onCancel }: AdminAppointmentRowProps) {
  const { client } = appointment;
  const displayStatus = useDisplayStatus(appointment);
  const isCancelled = displayStatus === DisplayStatus.CANCELLED;
  const canCancel = displayStatus === DisplayStatus.CONFIRMED;

  return (
    <li
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between',
        isCancelled && 'bg-muted/40 text-muted-foreground',
      )}
    >
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium tabular-nums">
            {formatTime(appointment.startAt)} – {formatTime(appointment.endAt)}
          </span>
          <span className={cn('truncate', !isCancelled && 'font-medium')}>{client.name}</span>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-3 text-sm">
          {client.phone && <span className="tabular-nums">{formatPhone(client.phone)}</span>}
          <span className="break-all">{client.email}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <StatusBadge
          displayStatus={displayStatus}
          cancelledBy={appointment.cancelledBy}
          viewer="ADMIN"
        />
        {canCancel && (
          <Button variant="outline" size="sm" onClick={() => onCancel(appointment)}>
            Cancelar
          </Button>
        )}
      </div>
    </li>
  );
}
