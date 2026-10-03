import type { AdminAppointmentDto } from '@agenda/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminSummary } from '@/features/admin/AdminSummary';
import { AgendaTab } from '@/features/admin/AgendaTab';
import { AllAppointmentsTab } from '@/features/admin/AllAppointmentsTab';
import { useAdminCancel } from '@/features/admin/use-admin';
import { formatInstantDate, formatTime, getBusinessToday } from '@/lib/format';

const AGENDA_TAB = 'agenda';
const ALL_TAB = 'todos';

/**
 * RF-07 to RF-10. The tab is in the URL (`?aba=todos`); each tab keeps its own parameters there
 * too (`dia` for the agenda, the filters for the list), so switching tabs does not lose them.
 */
export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('aba') === ALL_TAB ? ALL_TAB : AGENDA_TAB;
  const [today] = useState(() => getBusinessToday());

  const cancelAppointment = useAdminCancel();
  const [toCancel, setToCancel] = useState<AdminAppointmentDto | null>(null);

  function changeTab(value: string) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === ALL_TAB) next.set('aba', ALL_TAB);
        else next.delete('aba');
        return next;
      },
      { replace: true },
    );
  }

  function confirmCancel(appointment: AdminAppointmentDto) {
    cancelAppointment.mutate(appointment.id, {
      onSuccess: () => toast.success('Agendamento cancelado.'),
      onSettled: () => setToCancel(null),
    });
  }

  return (
    <section className="grid gap-6">
      <h1 className="text-2xl font-semibold">Painel</h1>
      <AdminSummary />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value={AGENDA_TAB}>Agenda</TabsTrigger>
          <TabsTrigger value={ALL_TAB}>Todos</TabsTrigger>
        </TabsList>
        <TabsContent value={AGENDA_TAB} className="pt-2">
          <AgendaTab today={today} onCancel={setToCancel} />
        </TabsContent>
        <TabsContent value={ALL_TAB} className="pt-2">
          <AllAppointmentsTab today={today} onCancel={setToCancel} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title={
          toCancel
            ? `Cancelar o agendamento de ${toCancel.client.name} em ${formatInstantDate(toCancel.startAt)} às ${formatTime(toCancel.startAt)}?`
            : 'Cancelar o agendamento?'
        }
        description="O cliente verá o agendamento como cancelado pelo estabelecimento e o horário ficará livre."
        confirmLabel="Cancelar agendamento"
        pendingLabel="Cancelando…"
        destructive
        isPending={cancelAppointment.isPending}
        onConfirm={() => toCancel && confirmCancel(toCancel)}
      />
    </section>
  );
}
