import { AppointmentScope, type AppointmentDto } from '@agenda/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageError, PageLoading } from '@/components/PageStatus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentCard } from '@/features/my-appointments/AppointmentCard';
import {
  useCancelAppointment,
  useMyAppointments,
} from '@/features/my-appointments/use-my-appointments';
import { formatInstantDate, formatTime } from '@/lib/format';

const HISTORY_TAB = 'historico';

const EMPTY_MESSAGES: Record<AppointmentScope, string> = {
  upcoming: 'Você não tem agendamentos futuros.',
  history: 'Seu histórico ainda está vazio.',
};

function AppointmentList({
  scope,
  onCancel,
}: {
  scope: AppointmentScope;
  onCancel?: (appointment: AppointmentDto) => void;
}) {
  const query = useMyAppointments(scope);

  if (query.isPending) return <PageLoading />;
  if (query.isError) return <PageError onRetry={() => void query.refetch()} />;

  if (query.data.items.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 py-12 text-center text-sm">
        <p className="text-muted-foreground">{EMPTY_MESSAGES[scope]}</p>
        <Link to="/agendar" className="underline underline-offset-4">
          Agendar um horário
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {query.data.items.map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} onCancel={onCancel} />
      ))}
    </ul>
  );
}

/** RF-05 / RF-06. The tab is in the URL (`?aba=historico`) so it survives a reload. */
export function MyAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab =
    searchParams.get('aba') === HISTORY_TAB ? AppointmentScope.HISTORY : AppointmentScope.UPCOMING;

  const cancelAppointment = useCancelAppointment();
  const [toCancel, setToCancel] = useState<AppointmentDto | null>(null);

  function changeTab(value: string) {
    setSearchParams(value === AppointmentScope.HISTORY ? { aba: HISTORY_TAB } : {}, {
      replace: true,
    });
  }

  function confirmCancel(appointment: AppointmentDto) {
    cancelAppointment.mutate(appointment.id, {
      onSuccess: () => toast.success('Agendamento cancelado.'),
      onSettled: () => setToCancel(null),
    });
  }

  return (
    <section className="grid gap-6">
      <h1 className="text-2xl font-semibold">Meus agendamentos</h1>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value={AppointmentScope.UPCOMING}>Próximos</TabsTrigger>
          <TabsTrigger value={AppointmentScope.HISTORY}>Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value={AppointmentScope.UPCOMING} className="pt-2">
          <AppointmentList scope={AppointmentScope.UPCOMING} onCancel={setToCancel} />
        </TabsContent>
        <TabsContent value={AppointmentScope.HISTORY} className="pt-2">
          <AppointmentList scope={AppointmentScope.HISTORY} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title={
          toCancel
            ? `Cancelar o agendamento de ${formatInstantDate(toCancel.startAt)} às ${formatTime(toCancel.startAt)}?`
            : 'Cancelar o agendamento?'
        }
        description="O horário ficará livre para outras pessoas."
        confirmLabel="Cancelar agendamento"
        pendingLabel="Cancelando…"
        destructive
        isPending={cancelAppointment.isPending}
        onConfirm={() => toCancel && confirmCancel(toCancel)}
      />
    </section>
  );
}
