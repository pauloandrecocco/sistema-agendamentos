import { DisplayStatus, type AdminAppointmentDto } from '@agenda/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageError, PageLoading } from '@/components/PageStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatLongDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { AdminAppointmentRow } from './AdminAppointmentRow';
import {
  groupByBusinessDate,
  hasInvalidPeriod,
  readListFilters,
  toListQuery,
  writeListFilters,
  type AdminListFilters,
} from './admin-list';
import { pluralize } from './admin-day-state';
import { useAdminAppointments } from './use-admin';

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS: { value: DisplayStatus | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: DisplayStatus.CONFIRMED, label: 'Confirmado' },
  { value: DisplayStatus.COMPLETED, label: 'Concluído' },
  { value: DisplayStatus.CANCELLED, label: 'Cancelado' },
];

type AllAppointmentsTabProps = {
  today: string;
  onCancel: (appointment: AdminAppointmentDto) => void;
};

/** RF-09: paginated list grouped by day; every filter lives in the URL. */
export function AllAppointmentsTab({ today, onCancel }: AllAppointmentsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readListFilters(searchParams, today);
  const invalidPeriod = hasInvalidPeriod(filters);

  const query = useAdminAppointments(toListQuery(filters), {
    enabled: !invalidPeriod,
    keepPrevious: true,
  });

  function updateFilters(patch: Partial<AdminListFilters>) {
    setSearchParams((previous) => writeListFilters(previous, patch), { replace: true });
  }

  // The search box goes to the URL (and the API) only after the typing stops.
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    if (debouncedSearch.trim() === filters.search.trim()) return;
    setSearchParams((previous) => writeListFilters(previous, { search: debouncedSearch }), {
      replace: true,
    });
  }, [debouncedSearch, filters.search, setSearchParams]);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (query.data?.pageSize ?? 1)));

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="filter-from">De</Label>
          <Input
            id="filter-from"
            type="date"
            value={filters.from}
            onChange={(event) => updateFilters({ from: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-to">Até</Label>
          <Input
            id="filter-to"
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            aria-invalid={invalidPeriod || undefined}
            aria-describedby={invalidPeriod ? 'filter-to-error' : undefined}
            onChange={(event) => updateFilters({ to: event.target.value || null })}
          />
          {invalidPeriod && (
            <p id="filter-to-error" className="text-destructive text-sm">
              A data final deve ser igual ou posterior à inicial.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-status">Status</Label>
          <NativeSelect
            id="filter-status"
            value={filters.status ?? ''}
            onChange={(event) =>
              updateFilters({ status: (event.target.value as DisplayStatus) || null })
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-search">Cliente</Label>
          <Input
            id="filter-search"
            type="search"
            placeholder="Nome, e-mail ou telefone"
            maxLength={100}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      {invalidPeriod ? null : query.isPending ? (
        <PageLoading />
      ) : query.isError ? (
        <PageError onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          Nenhum agendamento encontrado com esses filtros.
        </p>
      ) : (
        <div
          className={cn('grid gap-5 transition-opacity', query.isPlaceholderData && 'opacity-60')}
          aria-busy={query.isPlaceholderData || undefined}
        >
          {groupByBusinessDate(query.data.items).map((group) => (
            <section
              key={group.date}
              className="grid gap-2"
              aria-label={formatLongDate(group.date)}
            >
              <h3 className="text-sm font-semibold first-letter:uppercase">
                {formatLongDate(group.date)}
              </h3>
              <ul className="grid gap-2">
                {group.items.map((appointment) => (
                  <AdminAppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    onCancel={onCancel}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!invalidPeriod && total > 0 && (
        <nav
          aria-label="Paginação"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="text-muted-foreground">
            Página {filters.page} de {totalPages} ·{' '}
            {pluralize(total, 'agendamento', 'agendamentos')}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => updateFilters({ page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => updateFilters({ page: filters.page + 1 })}
            >
              Próxima
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
