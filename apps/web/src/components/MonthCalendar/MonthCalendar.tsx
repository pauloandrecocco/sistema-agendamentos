import { addMonthsToMonth } from '@agenda/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatLongDate, formatMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { buildMonthGrid } from './month-grid';

export type DayTone = 'default' | 'available' | 'unavailable' | 'blocked' | 'muted';

/** Per-day state supplied by the screen (the calendar knows nothing about availability rules). */
export type DayState = {
  disabled: boolean;
  tone: DayTone;
  /** Short description of the state, read by screen readers and shown as tooltip. */
  label?: string;
};

type BaseProps = {
  /** Displayed month, "YYYY-MM". */
  month: string;
  onMonthChange: (month: string) => void;
  /** Earliest month that can be shown: "previous" is disabled on it. */
  minMonth?: string;
  /** Today in the business timezone, highlighted in the grid. */
  today: string;
  getDayState?: (date: string) => DayState;
  /** Extra content inside a day cell (e.g. the admin's appointment count). */
  renderDayContent?: (date: string) => ReactNode;
  /** While the month's data loads, every day is disabled. */
  isLoading?: boolean;
  className?: string;
};

/** A click selects one day. Phase 7 adds a `multi` mode (toggle + drag selection) to the union. */
type SingleModeProps = {
  mode: 'single';
  selected: string | null;
  onSelect: (date: string) => void;
};

export type MonthCalendarProps = BaseProps & SingleModeProps;

const WEEKDAYS = [
  { short: 'D', name: 'domingo' },
  { short: 'S', name: 'segunda-feira' },
  { short: 'T', name: 'terça-feira' },
  { short: 'Q', name: 'quarta-feira' },
  { short: 'Q', name: 'quinta-feira' },
  { short: 'S', name: 'sexta-feira' },
  { short: 'S', name: 'sábado' },
];

const DEFAULT_STATE: DayState = { disabled: false, tone: 'default' };

const TONE_CLASSES: Record<DayTone, string> = {
  default: 'hover:bg-accent',
  available: 'bg-primary/10 font-semibold hover:bg-primary/20',
  unavailable: 'text-muted-foreground',
  blocked: 'bg-muted text-muted-foreground line-through',
  muted: 'text-muted-foreground/50',
};

/** Monthly calendar of PRD 15.2: own implementation over calendar-date strings ("YYYY-MM-DD"). */
export function MonthCalendar(props: MonthCalendarProps) {
  const { month, onMonthChange, minMonth, today, getDayState, renderDayContent, isLoading } = props;
  const weeks = useMemo(() => buildMonthGrid(month), [month]);
  const canGoBack = !minMonth || month > minMonth;

  return (
    <div className={cn('w-full', props.className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonthsToMonth(month, -1))}
          disabled={!canGoBack}
          aria-label="Mês anterior"
        >
          <ChevronLeft />
        </Button>
        <h2 className="font-semibold first-letter:uppercase" aria-live="polite">
          {formatMonthLabel(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onMonthChange(addMonthsToMonth(month, 1))}
          aria-label="Próximo mês"
        >
          <ChevronRight />
        </Button>
      </div>

      <div role="grid" aria-busy={isLoading || undefined} className="grid gap-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday.name}
              role="columnheader"
              aria-label={weekday.name}
              className="text-muted-foreground py-1 text-center text-xs font-medium"
            >
              {weekday.short}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week.find(Boolean)} role="row" className="grid grid-cols-7 gap-1">
            {week.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} role="gridcell" />;

              const state = getDayState?.(date) ?? DEFAULT_STATE;
              const isSelected = props.selected === date;
              const isToday = date === today;

              return (
                <div key={date} role="gridcell">
                  <button
                    type="button"
                    disabled={isLoading || state.disabled}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={[formatLongDate(date), state.label].filter(Boolean).join(', ')}
                    title={state.label}
                    onClick={() => props.onSelect(date)}
                    className={cn(
                      'flex aspect-square min-h-10 w-full flex-col items-center justify-center rounded-md text-sm transition-colors',
                      'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] disabled:cursor-default',
                      isLoading ? 'text-muted-foreground/50' : TONE_CLASSES[state.tone],
                      isToday && 'ring-foreground/30 ring-1',
                      isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                    )}
                  >
                    <span>{Number(date.slice(8))}</span>
                    {renderDayContent?.(date)}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
