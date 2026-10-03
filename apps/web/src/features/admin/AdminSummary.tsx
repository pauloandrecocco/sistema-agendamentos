import { Card } from '@/components/ui/card';
import { useAdminSummary } from './use-admin';

/** RF-07: not-cancelled appointments today and in the next 7 days. */
export function AdminSummary() {
  const summary = useAdminSummary();
  const items = [
    { label: 'Hoje', value: summary.data?.today },
    { label: 'Próximos 7 dias', value: summary.data?.next7Days },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      {items.map((item) => (
        <Card key={item.label} className="gap-1 p-4">
          <p className="text-muted-foreground text-sm">{item.label}</p>
          <p className="text-2xl font-semibold tabular-nums" aria-live="polite">
            {summary.isError ? '—' : (item.value ?? '…')}
          </p>
          <p className="text-muted-foreground text-xs">agendamentos não cancelados</p>
        </Card>
      ))}
    </div>
  );
}
