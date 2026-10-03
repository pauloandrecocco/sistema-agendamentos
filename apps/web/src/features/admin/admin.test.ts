import type { AdminCalendarDay, AppointmentDto } from '@agenda/shared';
import { describe, expect, it } from 'vitest';
import { getAdminDayState } from './admin-day-state';
import {
  groupByBusinessDate,
  hasInvalidPeriod,
  readListFilters,
  toListQuery,
  writeListFilters,
} from './admin-list';
import {
  buildBlockResultMessage,
  buildUnblockResultMessage,
  summarizeSelection,
} from './admin-selection';

const TODAY = '2026-10-05';

function day(date: string, overrides: Partial<AdminCalendarDay> = {}): AdminCalendarDay {
  return {
    date,
    appointmentsCount: 0,
    isClosed: false,
    isBlocked: false,
    isPast: false,
    ...overrides,
  };
}

function appointment(startAt: string): AppointmentDto {
  return {
    id: startAt,
    startAt,
    endAt: startAt,
    status: 'CANCELLED',
    displayStatus: 'CANCELLED',
    cancelledBy: 'ADMIN',
    cancelledAt: startAt,
    createdAt: startAt,
  };
}

describe('getAdminDayState', () => {
  it('tells past, blocked and closed days apart, with the count in the label', () => {
    expect(getAdminDayState(day(TODAY, { appointmentsCount: 2 }), 'view')).toEqual({
      disabled: false,
      tone: 'default',
      label: '2 agendamentos',
    });
    expect(getAdminDayState(day(TODAY, { isBlocked: true, isClosed: true }), 'view')).toMatchObject(
      { tone: 'blocked', label: 'Bloqueado, Fechado' },
    );
    expect(getAdminDayState(day(TODAY, { isClosed: true }), 'view').tone).toBe('closed');
    expect(
      getAdminDayState(day('2026-10-01', { isPast: true, appointmentsCount: 1 }), 'view'),
    ).toEqual({
      disabled: false,
      tone: 'muted',
      label: 'Data passada, 1 agendamento',
    });
  });

  it('keeps past days openable for viewing but not selectable for blocking', () => {
    const past = day('2026-10-01', { isPast: true });
    expect(getAdminDayState(past, 'view').disabled).toBe(false);
    expect(getAdminDayState(past, 'block').disabled).toBe(true);
    expect(getAdminDayState(day(TODAY, { isBlocked: true }), 'block').disabled).toBe(false);
  });

  it('disables a day whose data is missing', () => {
    expect(getAdminDayState(undefined, 'view').disabled).toBe(true);
  });
});

describe('summarizeSelection', () => {
  it('splits blocked from unblocked days and estimates cancellations from the counts', () => {
    const days = new Map([
      ['2026-10-06', day('2026-10-06', { appointmentsCount: 2 })],
      ['2026-10-07', day('2026-10-07', { isBlocked: true })],
      ['2026-11-02', day('2026-11-02', { appointmentsCount: 1 })],
    ]);
    expect(
      summarizeSelection(['2026-11-02', '2026-10-07', '2026-10-06'], (date) => days.get(date)),
    ).toEqual({
      toBlock: ['2026-10-06', '2026-11-02'],
      toUnblock: ['2026-10-07'],
      estimatedCancellations: 3,
    });
  });
});

describe('block result messages', () => {
  it('uses the cancelled list returned by the API (São Paulo time)', () => {
    expect(
      buildBlockResultMessage({
        blockedDates: ['2026-10-06', '2026-10-07'],
        cancelledAppointments: [appointment('2026-10-06T12:00:00.000Z')],
      }),
    ).toBe('2 dias bloqueados. 1 agendamento cancelado: 06/10/2026 às 09:00.');
  });

  it('says when nothing was cancelled and summarizes long lists', () => {
    expect(buildBlockResultMessage({ blockedDates: [TODAY], cancelledAppointments: [] })).toBe(
      '1 dia bloqueado. Nenhum agendamento cancelado.',
    );
    const many = Array.from({ length: 7 }, (_, index) =>
      appointment(`2026-10-06T1${index}:00:00.000Z`),
    );
    expect(buildBlockResultMessage({ blockedDates: [TODAY], cancelledAppointments: many })).toMatch(
      /^1 dia bloqueado\. 7 agendamentos cancelados: .* e mais 2\.$/,
    );
    expect(buildUnblockResultMessage({ unblockedDates: [TODAY, '2026-10-06'] })).toBe(
      '2 dias desbloqueados.',
    );
  });
});

describe('list filters in the URL', () => {
  it('defaults to today onwards, page 1, and ignores invalid values', () => {
    expect(readListFilters(new URLSearchParams('de=2026-02-30&status=x&pagina=-1'), TODAY)).toEqual(
      { from: TODAY, to: null, status: null, search: '', page: 1 },
    );
  });

  it('round-trips the filters and goes back to page 1 when a filter changes', () => {
    const params = writeListFilters(new URLSearchParams('aba=todos&pagina=3'), {
      from: '2026-10-01',
      to: '2026-10-31',
      status: 'CANCELLED',
      search: ' maria ',
    });
    expect(params.toString()).toBe(
      'aba=todos&de=2026-10-01&ate=2026-10-31&status=cancelado&busca=maria',
    );
    expect(readListFilters(params, TODAY)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      status: 'CANCELLED',
      search: 'maria',
      page: 1,
    });
    expect(writeListFilters(params, { page: 2 }).get('pagina')).toBe('2');
    expect(writeListFilters(params, { to: null }).has('ate')).toBe(false);
  });

  it('builds the API query and flags an inverted period', () => {
    const filters = readListFilters(new URLSearchParams('busca=%20&pagina=2'), TODAY);
    expect(toListQuery(filters)).toEqual({ from: TODAY, page: 2, pageSize: 20 });
    expect(hasInvalidPeriod({ ...filters, to: '2026-10-04' })).toBe(true);
    expect(hasInvalidPeriod({ ...filters, to: TODAY })).toBe(false);
  });
});

describe('groupByBusinessDate', () => {
  it('groups by the São Paulo date, not the UTC one', () => {
    // 22:00 in São Paulo on the 5th is 01:00Z on the 6th.
    const late = { startAt: '2026-10-06T01:00:00.000Z' };
    const next = { startAt: '2026-10-06T12:00:00.000Z' };
    const early = { startAt: '2026-10-05T12:00:00.000Z' };
    expect(groupByBusinessDate([early, late, next])).toEqual([
      { date: '2026-10-05', items: [early, late] },
      { date: '2026-10-06', items: [next] },
    ]);
  });
});
