import {
  scheduleConfigSchema,
  SLOT_DURATIONS,
  TIME_OPTIONS,
  type ScheduleConfig,
  type ScheduleConfigData,
  type ScheduleConfigInput,
} from '@agenda/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { PageError, PageLoading } from '@/components/PageStatus';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { useSaveSchedule, useScheduleConfig } from '@/features/admin/use-admin';
import { getErrorMessage, isUnauthenticated } from '@/lib/api-client';
import { applyApiErrors } from '@/lib/apply-api-errors';
import { cn } from '@/lib/utils';

/** Index = weekday (0 = Sunday), the order of the API rows. */
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Fields that a VALIDATION_ERROR from the API can point to ("workingHours.1.endTime", ...). */
const FIELDS: Path<ScheduleConfigInput>[] = [
  'slotDurationMinutes',
  ...WEEKDAY_NAMES.flatMap((_, index) => [
    `workingHours.${index}.startTime` as const,
    `workingHours.${index}.endTime` as const,
  ]),
];

/** RF-11: slot duration + weekly working hours, saved together. */
export function AdminSettingsPage() {
  const config = useScheduleConfig();

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Configurações da agenda</h1>
        <p className="text-muted-foreground">
          Duração dos horários e horário de funcionamento de cada dia da semana.
        </p>
      </header>
      {config.isPending ? (
        <PageLoading />
      ) : config.isError ? (
        <PageError onRetry={() => void config.refetch()} />
      ) : (
        <ScheduleForm config={config.data} />
      )}
    </section>
  );
}

function ScheduleForm({ config }: { config: ScheduleConfig }) {
  const save = useSaveSchedule();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ScheduleConfigInput, unknown, ScheduleConfigData>({
    resolver: zodResolver(scheduleConfigSchema),
    defaultValues: config,
  });

  const workingHours = useWatch({ control, name: 'workingHours' });

  const onSubmit = handleSubmit((data) => {
    save.mutate(data, {
      onSuccess: (saved) => {
        reset(saved);
        toast.success('Configuração salva.');
      },
      onError: (error) => {
        if (isUnauthenticated(error)) return;
        if (!applyApiErrors(error, setError, FIELDS)) toast.error(getErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-6">
      <Card className="gap-3 p-4">
        <fieldset className="grid gap-3">
          <legend className="mb-3 font-semibold">Duração de cada horário</legend>
          <Controller
            control={control}
            name="slotDurationMinutes"
            render={({ field }) => (
              <div className="flex gap-2">
                {SLOT_DURATIONS.map((duration) => (
                  <label
                    key={duration}
                    className={cn(
                      'has-focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm has-focus-visible:ring-[3px]',
                      field.value === duration && 'border-primary bg-primary/5 font-medium',
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={duration}
                      checked={field.value === duration}
                      onChange={() => field.onChange(duration)}
                      onBlur={field.onBlur}
                      className="accent-primary"
                    />
                    {duration} min
                  </label>
                ))}
              </div>
            )}
          />
          {errors.slotDurationMinutes && (
            <p className="text-destructive text-sm">{errors.slotDurationMinutes.message}</p>
          )}
        </fieldset>
      </Card>

      <Card className="gap-3 p-4">
        <fieldset className="grid gap-3">
          <legend className="mb-3 font-semibold">Horário semanal</legend>
          <ul className="grid divide-y">
            {WEEKDAY_NAMES.map((name, index) => {
              const isActive = workingHours[index]?.isActive;
              const rowErrors = errors.workingHours?.[index];
              const rowError = rowErrors?.endTime?.message ?? rowErrors?.startTime?.message;
              const errorId = `weekday-${index}-error`;
              return (
                <li
                  key={name}
                  className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <Controller
                      control={control}
                      name={`workingHours.${index}.isActive`}
                      render={({ field }) => (
                        <Switch
                          id={`weekday-${index}-active`}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                    <Label htmlFor={`weekday-${index}-active`}>{name}</Label>
                  </div>
                  <div className={cn('grid gap-1', !isActive && 'opacity-60')}>
                    <div className="flex items-center gap-2">
                      <NativeSelect
                        aria-label={`${name}: início`}
                        aria-invalid={rowErrors?.startTime ? true : undefined}
                        aria-describedby={rowError ? errorId : undefined}
                        className="sm:w-32"
                        {...register(`workingHours.${index}.startTime`)}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </NativeSelect>
                      <span className="text-muted-foreground text-sm">às</span>
                      <NativeSelect
                        aria-label={`${name}: fim`}
                        aria-invalid={rowErrors?.endTime ? true : undefined}
                        aria-describedby={rowError ? errorId : undefined}
                        className="sm:w-32"
                        {...register(`workingHours.${index}.endTime`)}
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </NativeSelect>
                      {!isActive && (
                        <span className="text-muted-foreground hidden text-sm sm:inline">
                          Fechado
                        </span>
                      )}
                    </div>
                    {rowError && (
                      <p id={errorId} className="text-destructive text-sm">
                        {rowError}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          As alterações valem para os próximos horários e não afetam agendamentos já existentes.
        </p>
        <Button type="submit" disabled={save.isPending || !isDirty}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
