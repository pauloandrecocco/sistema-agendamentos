import { DisplayStatus, type AppointmentDto } from '@agenda/shared';
import { Badge } from '@/components/ui/badge';
import { getStatusLabel, type StatusViewer } from '@/lib/appointment-status';
import { cn } from '@/lib/utils';

const STATUS_CLASSES: Record<DisplayStatus, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-secondary text-secondary-foreground',
  CANCELLED: 'bg-red-100 text-red-800',
};

/** Badge of the display status (RN-09), worded for who is looking at it. */
export function StatusBadge({
  displayStatus,
  cancelledBy,
  viewer,
}: {
  displayStatus: DisplayStatus;
  cancelledBy: AppointmentDto['cancelledBy'];
  viewer: StatusViewer;
}) {
  return (
    <Badge className={cn('border-transparent', STATUS_CLASSES[displayStatus])}>
      {getStatusLabel({ displayStatus, cancelledBy }, viewer)}
    </Badge>
  );
}
