import {
  AppointmentStatus,
  CancelledBy,
  Role,
  businessDateTimeToInstant,
  type AdminAppointmentListResponse,
  type AdminCalendarDay,
} from '@agenda/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppointmentRecord } from '../src/modules/appointments/appointments.repository.js';
import {
  addAppointment,
  addUser,
  buildTestApp,
  sessionCookieFor,
} from './helpers/build-test-app.js';

// Frozen now: Monday 2026-10-05 10:10 in São Paulo.
const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const at = (date: string, time: string) => businessDateTimeToInstant(date, time);
const NOW = at(MONDAY, '10:10');

let ctx: ReturnType<typeof buildTestApp>;
let maria: { id: string; role: Role };
let joao: { id: string; role: Role };
let mariaCookie: string;
let adminCookie: string;

beforeEach(async () => {
  ctx = buildTestApp({ now: NOW });
  maria = await addUser(ctx.users, {
    name: 'Maria Silva',
    email: 'maria@email.com',
    password: 'cliente123',
    phone: '11987654321',
  });
  joao = await addUser(ctx.users, {
    name: 'João Souza',
    email: 'joao@email.com',
    password: 'cliente123',
  });
  const admin = await addUser(ctx.users, {
    name: 'Administrador',
    email: 'admin@agenda.com',
    password: 'admin123',
    role: Role.ADMIN,
  });
  mariaCookie = sessionCookieFor(ctx.tokenService, maria);
  adminCookie = sessionCookieFor(ctx.tokenService, admin);
});

/** 30-minute appointment starting at `time` (business timezone). */
function book(
  clientId: string,
  date: string,
  time: string,
  extra: Partial<AppointmentRecord> = {},
): AppointmentRecord {
  const startAt = at(date, time);
  return addAppointment(ctx.appointments, {
    clientId,
    startAt,
    endAt: new Date(startAt.getTime() + 30 * 60_000),
    ...extra,
  });
}

const cancelledByClient = {
  status: AppointmentStatus.CANCELLED,
  cancelledBy: CancelledBy.CLIENT,
  cancelledAt: new Date('2026-10-01T12:00:00.000Z'),
};

function get(path: string, cookie = adminCookie) {
  return request(ctx.app).get(`/api${path}`).set('Cookie', cookie);
}

describe('admin route permissions', () => {
  const id = randomUUID();
  const routes = [
    ['get', '/api/admin/summary'],
    ['get', '/api/admin/calendar?month=2026-10'],
    ['get', '/api/admin/appointments'],
    ['post', `/api/admin/appointments/${id}/cancel`],
    ['get', '/api/admin/schedule'],
    ['put', '/api/admin/schedule'],
    ['post', '/api/admin/blocked-dates'],
    ['post', '/api/admin/blocked-dates/unblock'],
  ] as const;

  it.each(routes)('%s %s: 403 FORBIDDEN for a CLIENT', async (method, path) => {
    const res = await request(ctx.app)[method](path).set('Cookie', mariaCookie).send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  it.each(routes)('%s %s: 401 UNAUTHENTICATED for a visitor', async (method, path) => {
    const res = await request(ctx.app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('an unknown /admin path is still a 404', async () => {
    const res = await get('/admin/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/admin/summary', () => {
  it('counts CONFIRMED appointments of today (started included) and of the next 7 days', async () => {
    book(maria.id, MONDAY, '09:00'); // already started: still counts as today
    book(maria.id, MONDAY, '14:00');
    book(joao.id, MONDAY, '15:00', cancelledByClient); // cancelled: never counted
    book(joao.id, MONDAY, '22:00'); // 01:00Z on Tuesday, but Monday in São Paulo
    book(joao.id, '2026-10-04', '22:00'); // Sunday 22:00 = Monday 01:00Z: not today
    book(maria.id, TUESDAY, '10:00');
    book(maria.id, '2026-10-12', '22:00'); // today + 7, late at night
    book(maria.id, '2026-10-13', '10:00'); // today + 8: out

    const res = await get('/admin/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ today: 3, next7Days: 2 });
  });

  it('is zero without appointments', async () => {
    expect((await get('/admin/summary')).body).toEqual({ today: 0, next7Days: 0 });
  });
});

describe('GET /api/admin/calendar', () => {
  it('returns per-day counts and flags grouped by the business date', async () => {
    book(maria.id, '2026-09-30', '22:00'); // 01:00Z on Oct 1: belongs to September
    book(maria.id, MONDAY, '09:00');
    book(joao.id, MONDAY, '22:00');
    book(joao.id, MONDAY, '14:00', cancelledByClient);
    book(maria.id, '2026-10-31', '22:00'); // 01:00Z on Nov 1: still October 31
    ctx.blockedDates.dates.add('2026-10-07');

    const res = await get('/admin/calendar?month=2026-10');

    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-10');
    expect(res.body.days).toHaveLength(31);
    const day = (date: string) =>
      (res.body.days as AdminCalendarDay[]).find((candidate) => candidate.date === date);

    expect(day('2026-10-01')).toEqual({
      date: '2026-10-01',
      appointmentsCount: 0,
      isClosed: false,
      isBlocked: false,
      isPast: true,
    });
    expect(day('2026-10-04')).toMatchObject({ isClosed: true, isPast: true }); // Sunday
    expect(day(MONDAY)).toMatchObject({ appointmentsCount: 2, isPast: false, isClosed: false });
    expect(day(TUESDAY)).toMatchObject({ appointmentsCount: 0 });
    expect(day('2026-10-07')).toMatchObject({ isBlocked: true, isPast: false });
    expect(day('2026-10-31')).toMatchObject({ appointmentsCount: 1 });
  });

  it('400 for an invalid month', async () => {
    const res = await get('/admin/calendar?month=2026-13');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/admin/appointments', () => {
  let past: AppointmentRecord;
  let mondayStarted: AppointmentRecord;
  let mondayNow: AppointmentRecord;
  let mondayFuture: AppointmentRecord;
  let tuesdayCancelled: AppointmentRecord;
  let tuesdayNight: AppointmentRecord;

  beforeEach(() => {
    past = book(maria.id, '2026-10-02', '10:00');
    mondayStarted = book(maria.id, MONDAY, '09:00');
    mondayNow = book(joao.id, MONDAY, '10:10'); // startAt == now -> COMPLETED
    mondayFuture = book(maria.id, MONDAY, '14:00');
    tuesdayCancelled = book(joao.id, TUESDAY, '09:00', cancelledByClient);
    tuesdayNight = book(maria.id, TUESDAY, '22:00'); // 01:00Z on Wednesday
  });

  async function list(query = '') {
    const res = await get(`/admin/appointments${query}`);
    expect(res.status).toBe(200);
    return res.body as AdminAppointmentListResponse;
  }
  const ids = (body: AdminAppointmentListResponse) => body.items.map((item) => item.id);

  it('defaults to today onwards, ascending, with the client and the display status', async () => {
    const body = await list();

    expect(ids(body)).toEqual([
      mondayStarted.id,
      mondayNow.id,
      mondayFuture.id,
      tuesdayCancelled.id,
      tuesdayNight.id,
    ]);
    expect(body).toMatchObject({ page: 1, pageSize: 20, total: 5 });
    expect(body.items[0]).toEqual({
      id: mondayStarted.id,
      startAt: mondayStarted.startAt.toISOString(),
      endAt: mondayStarted.endAt.toISOString(),
      status: 'CONFIRMED',
      displayStatus: 'COMPLETED',
      cancelledBy: null,
      cancelledAt: null,
      createdAt: mondayStarted.createdAt.toISOString(),
      client: { id: maria.id, name: 'Maria Silva', email: 'maria@email.com', phone: '11987654321' },
    });
  });

  it('from/to are inclusive business dates', async () => {
    expect(ids(await list(`?from=${TUESDAY}&to=${TUESDAY}`))).toEqual([
      tuesdayCancelled.id,
      tuesdayNight.id,
    ]);
    expect(ids(await list('?from=2026-10-02&to=2026-10-02'))).toEqual([past.id]);
    expect(ids(await list('?from=2026-10-01')).at(0)).toBe(past.id);
  });

  it('filters by display status (RN-09)', async () => {
    expect(ids(await list('?status=CONFIRMED'))).toEqual([mondayFuture.id, tuesdayNight.id]);
    expect(ids(await list('?status=COMPLETED'))).toEqual([mondayStarted.id, mondayNow.id]);
    expect(ids(await list('?status=CANCELLED'))).toEqual([tuesdayCancelled.id]);
  });

  it('searching "maria" does not return João', async () => {
    const body = await list('?search=maria');
    expect(ids(body)).toEqual([mondayStarted.id, mondayFuture.id, tuesdayNight.id]);
    expect(body.items.every((item) => item.client.id === maria.id)).toBe(true);
  });

  it('searches name, e-mail and masked phone, case-insensitively', async () => {
    expect((await list('?search=SOUZA')).total).toBe(2);
    expect((await list('?search=joao%40')).total).toBe(2);
    expect(ids(await list(`?search=${encodeURIComponent('(11) 98765')}`))).toEqual([
      mondayStarted.id,
      mondayFuture.id,
      tuesdayNight.id,
    ]);
    // No digits in the term: the phone comparison is skipped instead of matching everyone.
    expect((await list('?search=zzz')).total).toBe(0);
  });

  it('paginates and reports the total', async () => {
    const body = await list('?page=2&pageSize=2');
    expect(ids(body)).toEqual([mondayFuture.id, tuesdayCancelled.id]);
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 5 });
    expect((await list('?page=9')).items).toEqual([]);
  });

  it('400 for from after to or an invalid status', async () => {
    for (const query of [`?from=${TUESDAY}&to=${MONDAY}`, '?status=PENDING', '?pageSize=101']) {
      const res = await get(`/admin/appointments${query}`);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('POST /api/admin/appointments/:id/cancel', () => {
  function cancel(id: string) {
    return request(ctx.app).post(`/api/admin/appointments/${id}/cancel`).set('Cookie', adminCookie);
  }

  it("cancels any client's future appointment with cancelledBy = ADMIN", async () => {
    const appointment = book(joao.id, TUESDAY, '10:00');

    const res = await cancel(appointment.id);

    expect(res.status).toBe(200);
    expect(res.body.appointment).toMatchObject({
      id: appointment.id,
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      cancelledBy: 'ADMIN',
      cancelledAt: NOW.toISOString(),
    });
    expect(ctx.appointments.appointments[0]?.cancelledBy).toBe(CancelledBy.ADMIN);
  });

  it('applies the RN-08 rules: already cancelled, already started, not found', async () => {
    const cancelled = book(joao.id, TUESDAY, '10:00', cancelledByClient);
    const started = book(maria.id, MONDAY, '10:00');

    const already = await cancel(cancelled.id);
    expect(already.status).toBe(422);
    expect(already.body.error.code).toBe('APPOINTMENT_ALREADY_CANCELLED');

    const begun = await cancel(started.id);
    expect(begun.status).toBe(422);
    expect(begun.body.error.code).toBe('APPOINTMENT_ALREADY_STARTED');

    const missing = await cancel(randomUUID());
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const invalid = await cancel('not-a-uuid');
    expect(invalid.status).toBe(400);
  });
});
