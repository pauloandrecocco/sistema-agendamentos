import {
  getMonthOfDate,
  isValidDateString,
  Role,
  type DayAvailabilityStatus,
  type SlotDto,
} from '@agenda/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MonthCalendar } from '@/components/MonthCalendar';
import { PageError, PageLoading } from '@/components/PageStatus';
import { Card } from '@/components/ui/card';
import { useSession } from '@/features/auth/use-session';
import { buildSlotLoginPath, findSlot } from '@/features/booking/booking-url';
import { DAY_STATE_LEGEND, getAvailabilityDayState } from '@/features/booking/day-state';
import { SlotGrid } from '@/features/booking/SlotGrid';
import {
  useAvailabilityCalendar,
  useCreateAppointment,
  useDayAvailability,
} from '@/features/booking/use-booking';
import { ApiError, getErrorMessage, isUnauthenticated } from '@/lib/api-client';
import { formatDate, formatLongDate, formatTime, getBusinessToday } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const ADMIN_NOTICE = 'Administradores não realizam agendamentos.';
const SLOT_GONE_MESSAGE = 'Esse horário não está mais disponível';
const SLOT_TAKEN_MESSAGE = 'Esse horário acabou de ser reservado';

const LEGEND_SWATCHES: Partial<Record<DayAvailabilityStatus, string>> = {
  AVAILABLE: 'bg-primary/10 border-primary/30',
  NO_SLOTS: 'bg-background',
  CLOSED: 'bg-background',
  BLOCKED: 'bg-muted',
};

/**
 * RF-02 to RF-04. The URL holds the page state so it survives a reload and the login round trip:
 * `date` is the selected day and `slot` the slot being confirmed (the dialog is open while a
 * CLIENT has a `slot` that is still free).
 */
export function BookingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const user = session.data ?? null;
  const isClient = user?.role === Role.CLIENT;
  const isAdmin = user?.role === Role.ADMIN;

  const [today] = useState(() => getBusinessToday());
  const currentMonth = getMonthOfDate(today);

  const dateParam = searchParams.get('date');
  const selectedDate = dateParam && isValidDateString(dateParam) ? dateParam : null;
  const slotParam = searchParams.get('slot');

  const [month, setMonth] = useState(() =>
    selectedDate && getMonthOfDate(selectedDate) > currentMonth
      ? getMonthOfDate(selectedDate)
      : currentMonth,
  );

  const calendar = useAvailabilityCalendar(month);
  const day = useDayAvailability(selectedDate);
  const createAppointment = useCreateAppointment();
  const slotsRef = useRef<HTMLDivElement>(null);

  const statusByDate = useMemo(
    () => new Map(calendar.data?.days.map((entry) => [entry.date, entry.status])),
    [calendar.data],
  );

  const slotToConfirm =
    isClient && slotParam && day.data ? findSlot(day.data.slots, slotParam) : undefined;

  const clearSlot = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('slot');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // Back from the login (or a reload) with a `slot` that is no longer free: tell the client and
  // drop it. Only decided on fresh data, and never right after this page booked that slot itself.
  const slotIsGone =
    isClient &&
    !!slotParam &&
    day.isSuccess &&
    !day.isFetching &&
    !slotToConfirm &&
    !createAppointment.isSuccess;
  useEffect(() => {
    if (!slotIsGone) return;
    toast.error(SLOT_GONE_MESSAGE, { id: 'slot-gone' });
    clearSlot();
  }, [slotIsGone, clearSlot]);

  // Admins only browse: a `slot` in the URL is ignored (the notice is already on the page).
  useEffect(() => {
    if (isAdmin && slotParam) clearSlot();
  }, [isAdmin, slotParam, clearSlot]);

  function selectDate(date: string) {
    setSearchParams({ date }, { replace: true });
    // On narrow screens the slots are below the calendar: bring them into view.
    if (window.matchMedia('(max-width: 767px)').matches) {
      requestAnimationFrame(() =>
        slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  }

  function selectSlot(slot: SlotDto) {
    if (!selectedDate) return;
    if (!user) {
      void navigate(buildSlotLoginPath(selectedDate, slot.startAt));
    } else if (isAdmin) {
      toast.info(ADMIN_NOTICE, { id: 'admin-notice' });
    } else {
      setSearchParams({ date: selectedDate, slot: slot.startAt }, { replace: true });
    }
  }

  function confirmBooking(slot: SlotDto) {
    createAppointment.mutate(slot.startAt, {
      onSuccess: () => {
        toast.success(
          `Agendamento confirmado para ${formatDate(selectedDate!)} às ${formatTime(slot.startAt)}.`,
        );
        // Drop `slot` from this history entry first: going Back must not reopen (or report as
        // taken) the slot that was just booked.
        clearSlot();
        void navigate('/meus-agendamentos');
      },
      onError: (error) => {
        if (isUnauthenticated(error)) {
          // The session expired (already cleared, no toast): log in and come back to this slot.
          void navigate(buildSlotLoginPath(selectedDate!, slot.startAt), { replace: true });
          return;
        }
        clearSlot();
        toast.error(
          error instanceof ApiError && error.code === 'SLOT_ALREADY_BOOKED'
            ? SLOT_TAKEN_MESSAGE
            : getErrorMessage(error),
        );
        // Whatever went wrong (taken, past, no longer valid), slots and calendar are outdated.
        void queryClient.invalidateQueries({ queryKey: queryKeys.availability.all });
      },
    });
  }

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Agendar</h1>
        <p className="text-muted-foreground">
          Escolha um dia e um horário disponível para o seu atendimento.
        </p>
      </header>

      {isAdmin && (
        <p
          role="note"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {ADMIN_NOTICE} Os horários são exibidos apenas para consulta.
        </p>
      )}

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Card className="gap-4 p-4">
          <MonthCalendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            minMonth={currentMonth}
            today={today}
            selected={selectedDate}
            onSelect={selectDate}
            isLoading={!calendar.isSuccess}
            getDayState={(date) => getAvailabilityDayState(statusByDate.get(date))}
          />
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
            {DAY_STATE_LEGEND.map((entry) => (
              <li key={entry.status} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn('size-3 rounded-sm border', LEGEND_SWATCHES[entry.status])}
                />
                {entry.label}
              </li>
            ))}
          </ul>
        </Card>

        <Card ref={slotsRef} className="scroll-mt-4 gap-4 p-4">
          {selectedDate ? (
            <>
              <h2 className="font-semibold first-letter:uppercase">
                {formatLongDate(selectedDate)}
              </h2>
              {day.isPending ? (
                <PageLoading />
              ) : day.isError ? (
                <PageError onRetry={() => void day.refetch()} />
              ) : (
                <SlotGrid
                  slots={day.data.slots}
                  onSelect={selectSlot}
                  disabled={session.isPending || createAppointment.isPending}
                />
              )}
            </>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Selecione um dia disponível no calendário para ver os horários.
            </p>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!slotToConfirm}
        onOpenChange={(open) => !open && clearSlot()}
        title={
          slotToConfirm && selectedDate
            ? `Confirmar agendamento em ${formatDate(selectedDate)} às ${formatTime(slotToConfirm.startAt)}?`
            : 'Confirmar agendamento?'
        }
        description={
          slotToConfirm &&
          `Atendimento das ${formatTime(slotToConfirm.startAt)} às ${formatTime(slotToConfirm.endAt)}.`
        }
        confirmLabel="Confirmar"
        pendingLabel="Confirmando…"
        isPending={createAppointment.isPending}
        onConfirm={() => slotToConfirm && confirmBooking(slotToConfirm)}
      />
    </section>
  );
}
