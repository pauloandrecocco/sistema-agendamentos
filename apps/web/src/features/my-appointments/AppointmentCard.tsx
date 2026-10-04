import { DisplayStatus, type AppointmentDto } from '@agenda/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useDisplayStatus } from '@/lib/appointment-status';
import { formatInstantWeekdayDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type AppointmentCardProps = {
  appointment: AppointmentDto;
  /** Passed only on upcoming appointments (RF-06); shown while it has not started (RN-08). */
  onCancel?: (appointment: AppointmentDto) => void;
};

export function AppointmentCard({ appointment, onCancel }: AppointmentCardProps) {
  const displayStatus = useDisplayStatus(appointment);
  const isCancelled = displayStatus === DisplayStatus.CANCELLED;
  const canCancel = !!onCancel && displayStatus === DisplayStatus.CONFIRMED;
  return (
    <li
      className={cn(
        'bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
        isCancelled && 'bg-muted/40',
      )}
    >
      <div className="grid gap-1">
        <p
          className={cn(
            'font-medium first-letter:uppercase',
            isCancelled && 'text-muted-foreground',
          )}
        >
          {formatInstantWeekdayDate(appointment.startAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {formatTime(appointment.startAt)} – {formatTime(appointment.endAt)}
          </span>
          <StatusBadge
            displayStatus={displayStatus}
            cancelledBy={appointment.cancelledBy}
            viewer="CLIENT"
          />
        </div>
      </div>
      {canCancel && (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => onCancel(appointment)}
        >
          Cancelar
        </Button>
      )}
    </li>
  );
}
