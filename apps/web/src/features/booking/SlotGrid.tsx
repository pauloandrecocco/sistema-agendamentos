import type { SlotDto } from '@agenda/shared';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';

type SlotGridProps = {
  slots: readonly SlotDto[];
  onSelect: (slot: SlotDto) => void;
  disabled?: boolean;
};

/** Free slots of a day as a grid of time buttons (RF-03). */
export function SlotGrid({ slots, onSelect, disabled }: SlotGridProps) {
  if (slots.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        Nenhum horário disponível neste dia.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slots.map((slot) => (
        <li key={slot.startAt}>
          <Button
            variant="outline"
            className="h-10 w-full tabular-nums"
            disabled={disabled}
            onClick={() => onSelect(slot)}
          >
            {formatTime(slot.startAt)}
          </Button>
        </li>
      ))}
    </ul>
  );
}
