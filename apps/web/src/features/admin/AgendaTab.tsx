import {
  getMonthOfDate,
  isValidDateString,
  type AdminAppointmentDto,
  type AdminCalendarDay,
} from '@agenda/shared';
import { useQueries } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MonthCalendar } from '@/components/MonthCalendar';
import { PageError, PageLoading } from '@/components/PageStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatLongDate } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { AdminAppointmentRow } from './AdminAppointmentRow';
import { getAdminDayState, pluralize, type AgendaMode } from './admin-day-state';
import {
  buildBlockResultMessage,
  buildUnblockResultMessage,
  summarizeSelection,
} from './admin-selection';
import {
  fetchAdminCalendar,
  useAdminAppointments,
  useAdminCalendar,
  useBlockDates,
  useUnblockDates,
} from './use-admin';

/** Enough for a whole day: at most 48 slots of 30 min, plus cancelled ones. */
const DAY_PAGE_SIZE = 100;

const LEGEND = [
  { label: 'Bloqueado', swatch: 'bg-muted' },
  { label: 'Fechado', swatch: 'border-dashed' },
  { label: 'Passado', swatch: 'bg-background opacity-50' },
];

type AgendaTabProps = {
  today: string;
  onCancel: (appointment: AdminAppointmentDto) => void;
};

/**
 * RF-08. View mode: a click shows the day's appointments (`?dia=` in the URL). Block mode
 * ("Gerenciar bloqueios"): days are selected (click/tap toggles, mouse drag selects a range)
 * and then blocked or unblocked together.
 */
export function AgendaTab({ today, onCancel }: AgendaTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dayParam = searchParams.get('dia');
  const selectedDate = dayParam && isValidDateString(dayParam) ? dayParam : null;

  const [month, setMonth] = useState(() => getMonthOfDate(selectedDate ?? today));
  const [mode, setMode] = useState<AgendaMode>('view');
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState<'block' | 'unblock' | null>(null);
  const dayPanelRef = useRef<HTMLDivElement>(null);

  const calendar = useAdminCalendar(month);
  const blockDates = useBlockDates();
  const unblockDates = useUnblockDates();

  // The selection may span months: the summary needs the calendar of each of them (cached).
  const selectionMonths = useMemo(
    () => [...new Set([...selection].map(getMonthOfDate))].sort(),
    [selection],
  );
  const selectionCalendars = useQueries({
    queries: selectionMonths.map((selectionMonth) => ({
      queryKey: queryKeys.admin.calendar(selectionMonth),
      queryFn: () => fetchAdminCalendar(selectionMonth),
    })),
  });

  const daysByDate = new Map<string, AdminCalendarDay>();
  for (const response of [calendar.data, ...selectionCalendars.map((query) => query.data)]) {
    for (const day of response?.days ?? []) daysByDate.set(day.date, day);
  }

  const summary = summarizeSelection(selection, (date) => daysByDate.get(date));

  function selectDate(date: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('dia', date);
        return next;
      },
      { replace: true },
    );
    // On narrow screens the day list is below the calendar: bring it into view.
    if (window.matchMedia('(max-width: 767px)').matches) {
      requestAnimationFrame(() =>
        dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }

  function changeMode(blockMode: boolean) {
    setMode(blockMode ? 'block' : 'view');
    setSelection(new Set());
  }

  function confirmBlock() {
    blockDates.mutate(summary.toBlock, {
      onSuccess: (response) => {
        toast.success(buildBlockResultMessage(response), { duration: 8000 });
        setSelection(new Set());
      },
      onSettled: () => setConfirming(null),
    });
  }

  function confirmUnblock() {
    unblockDates.mutate(summary.toUnblock, {
      onSuccess: (response) => {
        toast.success(buildUnblockResultMessage(response));
        setSelection(new Set());
      },
      onSettled: () => setConfirming(null),
    });
  }

  const calendarProps = {
    month,
    onMonthChange: setMonth,
    today,
    isLoading: !calendar.isSuccess,
    getDayState: (date: string) => getAdminDayState(daysByDate.get(date), mode),
    renderDayContent: (date: string) => {
      const count = daysByDate.get(date)?.appointmentsCount ?? 0;
      return count > 0 ? (
        <span aria-hidden className="text-[0.65rem] leading-4 font-semibold tabular-nums">
          {count}
        </span>
      ) : null;
    },
  };

  const isMutating = blockDates.isPending || unblockDates.isPending;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <Card className="gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="manage-blocks">Gerenciar bloqueios</Label>
          <Switch id="manage-blocks" checked={mode === 'block'} onCheckedChange={changeMode} />
        </div>
        {mode === 'block' && (
          <p className="text-muted-foreground text-sm">
            Toque ou clique nos dias para selecionar; com o mouse, clique e arraste para selecionar
            um intervalo. Dias passados não podem ser selecionados.
          </p>
        )}

        {mode === 'view' ? (
          <MonthCalendar
            mode="single"
            selected={selectedDate}
            onSelect={selectDate}
            {...calendarProps}
          />
        ) : (
          <MonthCalendar
            mode="multi"
            selected={selection}
            onSelectionChange={setSelection}
            {...calendarProps}
          />
        )}

        {calendar.isError && (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>Não foi possível carregar o calendário.</span>
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => void calendar.refetch()}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {LEGEND.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-3 rounded-sm border', entry.swatch)} />
              {entry.label}
            </li>
          ))}
          <li>Número = agendamentos não cancelados</li>
        </ul>

        {mode === 'block' && selection.size > 0 && (
          <div
            role="toolbar"
            aria-label="Ações da seleção"
            className="bg-muted/50 grid gap-2 rounded-md border p-3"
          >
            <p className="text-sm font-medium">
              {pluralize(selection.size, 'dia selecionado', 'dias selecionados')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={summary.toBlock.length === 0 || isMutating}
                onClick={() => setConfirming('block')}
              >
                Bloquear {pluralize(summary.toBlock.length, 'dia', 'dias')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={summary.toUnblock.length === 0 || isMutating}
                onClick={() => setConfirming('unblock')}
              >
                Desbloquear {pluralize(summary.toUnblock.length, 'dia', 'dias')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isMutating}
                onClick={() => setSelection(new Set())}
              >
                Limpar seleção
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card ref={dayPanelRef} className="scroll-mt-4 gap-4 p-4">
        {selectedDate ? (
          <DayAppointments
            date={selectedDate}
            day={daysByDate.get(selectedDate)}
            onCancel={onCancel}
          />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Selecione um dia no calendário para ver os agendamentos.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={confirming === 'block'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Bloquear ${pluralize(summary.toBlock.length, 'dia', 'dias')}?`}
        description={
          summary.estimatedCancellations > 0
            ? `Até ${pluralize(summary.estimatedCancellations, 'agendamento confirmado', 'agendamentos confirmados')} nessas datas ${summary.estimatedCancellations === 1 ? 'será cancelado' : 'serão cancelados'}. Os que já começaram permanecem.`
            : 'Não há agendamentos confirmados nessas datas.'
        }
        confirmLabel="Bloquear"
        pendingLabel="Bloqueando…"
        destructive
        isPending={blockDates.isPending}
        onConfirm={confirmBlock}
      />
      <ConfirmDialog
        open={confirming === 'unblock'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Desbloquear ${pluralize(summary.toUnblock.length, 'dia', 'dias')}?`}
        description="Os dias voltam a seguir o horário semanal. Agendamentos cancelados pelo bloqueio não são restaurados."
        confirmLabel="Desbloquear"
        pendingLabel="Desbloqueando…"
        isPending={unblockDates.isPending}
        onConfirm={confirmUnblock}
      />
    </div>
  );
}

/**
 * Appointments of one day, cancelled ones included. No placeholder data: while another day
 * loads, the previous day's list (and its "Cancelar" buttons) is not shown under the new title.
 */
function DayAppointments({
  date,
  day,
  onCancel,
}: {
  date: string;
  day: AdminCalendarDay | undefined;
  onCancel: (appointment: AdminAppointmentDto) => void;
}) {
  const query = useAdminAppointments({ from: date, to: date, page: 1, pageSize: DAY_PAGE_SIZE });
  const flags = [day?.isBlocked && 'Bloqueado', day?.isClosed && 'Fechado'].filter(Boolean);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold first-letter:uppercase">{formatLongDate(date)}</h2>
        {flags.length > 0 && (
          <span className="text-muted-foreground text-sm">{flags.join(' · ')}</span>
        )}
      </div>
      {query.isPending ? (
        <PageLoading />
      ) : query.isError ? (
        <PageError onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Nenhum agendamento neste dia.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label={`Agendamentos de ${formatLongDate(date)}`}>
          {query.data.items.map((appointment) => (
            <AdminAppointmentRow
              key={appointment.id}
              appointment={appointment}
              onCancel={onCancel}
            />
          ))}
        </ul>
      )}
    </>
  );
}
