import {
  AppointmentStatus,
  CancelledBy,
  Role,
  businessDateTimeToInstant,
  type AppointmentDto,
  type AvailabilityResponse,
} from '@agenda/shared';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

let ctx: ReturnType<typeof buildTestApp>;
let maria: { id: string; role: Role };
let mariaCookie: string;
let joaoCookie: string;
let adminCookie: string;

beforeEach(async () => {
  ctx = buildTestApp({ now: at(MONDAY, '10:10') });
  maria = await addUser(ctx.users, { email: 'maria@email.com', password: 'cliente123' });
  const joao = await addUser(ctx.users, { email: 'joao@email.com', password: 'cliente123' });
  const admin = await addUser(ctx.users, {
    email: 'admin@agenda.com',
    password: 'admin123',
    role: Role.ADMIN,
  });
  mariaCookie = sessionCookieFor(ctx.tokenService, maria);
  joaoCookie = sessionCookieFor(ctx.tokenService, joao);
  adminCookie = sessionCookieFor(ctx.tokenService, admin);
});

function book(startAt: string | Date, cookie = mariaCookie) {
  return request(ctx.app)
    .post('/api/appointments')
    .set('Cookie', cookie)
    .send({ startAt: startAt instanceof Date ? startAt.toISOString() : startAt });
}

function cancel(id: string, cookie = mariaCookie) {
  return request(ctx.app).post(`/api/appointments/${id}/cancel`).set('Cookie', cookie);
}

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const details = code === 'VALIDATION_ERROR' ? { details: expect.any(Object) } : {};
  expect(res.body).toEqual({ error: { code, message: expect.any(String), ...details } });
}

describe('POST /api/appointments', () => {
  it('creates a CONFIRMED appointment with endAt = startAt + current duration', async () => {
    const res = await book(at(TUESDAY, '14:00'));

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      appointment: {
        id: expect.any(String),
        startAt: '2026-10-06T17:00:00.000Z',
        endAt: '2026-10-06T17:30:00.000Z',
        status: 'CONFIRMED',
        displayStatus: 'CONFIRMED',
        cancelledBy: null,
        cancelledAt: null,
        createdAt: expect.any(String),
      },
    });
    expect(ctx.appointments.appointments).toHaveLength(1);
    expect(ctx.appointments.appointments[0]?.clientId).toBe(maria.id);
  });

  it('freezes a 60-minute duration when that is the current setting', async () => {
    ctx.schedule.config.slotDurationMinutes = 60;

    const res = await book(at(TUESDAY, '14:00'));

    expect(res.status).toBe(201);
    expect(res.body.appointment.endAt).toBe(at(TUESDAY, '15:00').toISOString());
  });

  it('accepts startAt with an offset and answers in UTC', async () => {
    const res = await book('2026-10-06T14:00:00-03:00');

    expect(res.status).toBe(201);
    expect(res.body.appointment.startAt).toBe('2026-10-06T17:00:00.000Z');
  });

  it('removes the booked slot from the availability', async () => {
    await book(at(TUESDAY, '14:00'));

    const res = await request(ctx.app).get('/api/availability').query({ date: TUESDAY });
    const { slots } = res.body as AvailabilityResponse;
    expect(slots.map((slot) => slot.startAt)).not.toContain(at(TUESDAY, '14:00').toISOString());
  });

  it('422 SLOT_IN_PAST for a start in the past or exactly now', async () => {
    expectError(await book(at(MONDAY, '10:00')), 422, 'SLOT_IN_PAST');
    expectError(await book(at(MONDAY, '10:10')), 422, 'SLOT_IN_PAST');
    expectError(await book(at('2026-10-02', '14:00')), 422, 'SLOT_IN_PAST');
    expect(ctx.appointments.appointments).toHaveLength(0);
  });

  it('422 SLOT_NOT_AVAILABLE for a closed day, a blocked day, outside working hours or misaligned', async () => {
    ctx.blockedDates.dates.add(TUESDAY);

    expectError(await book(at('2026-10-11', '10:00')), 422, 'SLOT_NOT_AVAILABLE'); // Sunday
    expectError(await book(at(TUESDAY, '14:00')), 422, 'SLOT_NOT_AVAILABLE'); // blocked
    expectError(await book(at('2026-10-07', '18:00')), 422, 'SLOT_NOT_AVAILABLE'); // after hours
    expectError(await book(at('2026-10-07', '08:30')), 422, 'SLOT_NOT_AVAILABLE'); // before hours
    expectError(await book(at('2026-10-07', '14:15')), 422, 'SLOT_NOT_AVAILABLE'); // misaligned
    expectError(await book(at('2026-10-10', '13:00')), 422, 'SLOT_NOT_AVAILABLE'); // Saturday ends 13:00
    expect(ctx.appointments.appointments).toHaveLength(0);
  });

  it('409 SLOT_ALREADY_BOOKED when the slot is taken', async () => {
    expect((await book(at(TUESDAY, '14:00'))).status).toBe(201);

    const res = await book(at(TUESDAY, '14:00'), joaoCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'SLOT_ALREADY_BOOKED', message: 'Este horário já foi reservado.' },
    });
  });

  it('409 on a partial overlap after the duration changed from 30 to 60', async () => {
    addAppointment(ctx.appointments, {
      startAt: at(TUESDAY, '14:30'),
      endAt: at(TUESDAY, '15:00'),
    });
    ctx.schedule.config.slotDurationMinutes = 60;

    expectError(await book(at(TUESDAY, '14:00')), 409, 'SLOT_ALREADY_BOOKED');
    expect((await book(at(TUESDAY, '15:00'))).status).toBe(201);
  });

  it('a cancelled appointment does not hold the slot', async () => {
    addAppointment(ctx.appointments, {
      startAt: at(TUESDAY, '14:00'),
      endAt: at(TUESDAY, '14:30'),
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.CLIENT,
      cancelledAt: at(MONDAY, '09:00'),
    });

    expect((await book(at(TUESDAY, '14:00'))).status).toBe(201);
  });

  it('turns the exclusion constraint violation (simulated by the fake) into 409', async () => {
    ctx.appointments.simulateOverlapOnNextCreate = true;

    const res = await book(at(TUESDAY, '14:00'));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'SLOT_ALREADY_BOOKED', message: 'Este horário já foi reservado.' },
    });
  });

  it('400 VALIDATION_ERROR for a missing or invalid startAt', async () => {
    for (const body of [{}, { startAt: '2026-10-06T14:00:00' }, { startAt: 'amanhã' }]) {
      const res = await request(ctx.app)
        .post('/api/appointments')
        .set('Cookie', mariaCookie)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty('startAt');
    }
  });

  it('401 for a visitor and 403 for an admin', async () => {
    const visitor = await request(ctx.app)
      .post('/api/appointments')
      .send({ startAt: at(TUESDAY, '14:00').toISOString() });
    expectError(visitor, 401, 'UNAUTHENTICATED');

    expectError(await book(at(TUESDAY, '14:00'), adminCookie), 403, 'FORBIDDEN');
    expect(ctx.appointments.appointments).toHaveLength(0);
  });
});

describe('GET /api/appointments/me', () => {
  beforeEach(() => {
    const mine = (start: string, data: Partial<Parameters<typeof addAppointment>[1]> = {}) => {
      const [date, time] = start.split(' ') as [string, string];
      const startAt = at(date, time);
      addAppointment(ctx.appointments, {
        clientId: maria.id,
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60_000),
        ...data,
      });
    };
    mine('2026-10-08 10:00');
    mine('2026-10-06 09:00');
    mine('2026-10-02 09:00'); // completed
    mine(`${MONDAY} 10:00`); // started 10 minutes ago: completed
    mine('2026-10-09 15:00', {
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.ADMIN,
      cancelledAt: at('2026-10-03', '12:00'),
    });
    // Someone else's appointment never shows up.
    addAppointment(ctx.appointments, {
      startAt: at('2026-10-07', '09:00'),
      endAt: at('2026-10-07', '09:30'),
    });
  });

  const list = async (scope?: string) => {
    const res = await request(ctx.app)
      .get('/api/appointments/me')
      .query(scope ? { scope } : {})
      .set('Cookie', mariaCookie);
    expect(res.status).toBe(200);
    return (res.body as { items: AppointmentDto[] }).items;
  };

  it('upcoming (default): CONFIRMED starting after now, ascending', async () => {
    const items = await list();

    expect(items.map((item) => item.startAt)).toEqual([
      at('2026-10-06', '09:00').toISOString(),
      at('2026-10-08', '10:00').toISOString(),
    ]);
    expect(items.every((item) => item.displayStatus === 'CONFIRMED')).toBe(true);
  });

  it('history: completed and cancelled, descending, with who cancelled', async () => {
    const items = await list('history');

    expect(items.map((item) => [item.startAt, item.displayStatus, item.cancelledBy])).toEqual([
      [at('2026-10-09', '15:00').toISOString(), 'CANCELLED', 'ADMIN'],
      [at(MONDAY, '10:00').toISOString(), 'COMPLETED', null],
      [at('2026-10-02', '09:00').toISOString(), 'COMPLETED', null],
    ]);
  });

  it('400 for an invalid scope, 403 for an admin', async () => {
    const invalid = await request(ctx.app)
      .get('/api/appointments/me')
      .query({ scope: 'all' })
      .set('Cookie', mariaCookie);
    expectError(invalid, 400, 'VALIDATION_ERROR');

    const admin = await request(ctx.app).get('/api/appointments/me').set('Cookie', adminCookie);
    expectError(admin, 403, 'FORBIDDEN');
  });
});

describe('POST /api/appointments/:id/cancel', () => {
  const future = () =>
    addAppointment(ctx.appointments, {
      clientId: maria.id,
      startAt: at(TUESDAY, '14:00'),
      endAt: at(TUESDAY, '14:30'),
    });

  it('cancels the client own future appointment and frees the slot', async () => {
    const appointment = future();

    const res = await cancel(appointment.id);

    expect(res.status).toBe(200);
    expect(res.body.appointment).toMatchObject({
      id: appointment.id,
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      cancelledBy: 'CLIENT',
      cancelledAt: at(MONDAY, '10:10').toISOString(),
    });
    expect(ctx.appointments.appointments).toHaveLength(1); // never deleted

    const availability = await request(ctx.app).get('/api/availability').query({ date: TUESDAY });
    const { slots } = availability.body as AvailabilityResponse;
    expect(slots.map((slot) => slot.startAt)).toContain(at(TUESDAY, '14:00').toISOString());
  });

  it('404 for another client appointment (does not reveal it) and for an unknown id', async () => {
    const appointment = future();

    expectError(await cancel(appointment.id, joaoCookie), 404, 'NOT_FOUND');
    expectError(await cancel(randomUUID()), 404, 'NOT_FOUND');
    expect(ctx.appointments.appointments[0]?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('400 for a malformed id', async () => {
    expectError(await cancel('123'), 400, 'VALIDATION_ERROR');
  });

  it('422 APPOINTMENT_ALREADY_CANCELLED when cancelled twice', async () => {
    const appointment = future();
    expect((await cancel(appointment.id)).status).toBe(200);

    expectError(await cancel(appointment.id), 422, 'APPOINTMENT_ALREADY_CANCELLED');
    expect(ctx.appointments.appointments[0]?.cancelledBy).toBe(CancelledBy.CLIENT);
  });

  it('422 APPOINTMENT_ALREADY_CANCELLED when a concurrent cancellation wins (conditional update)', async () => {
    const appointment = future();
    // The read still sees CONFIRMED, but another request cancelled it before our update.
    vi.spyOn(ctx.appointments, 'findById').mockResolvedValueOnce({ ...appointment });
    Object.assign(ctx.appointments.appointments[0]!, {
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.ADMIN,
      cancelledAt: at(MONDAY, '10:05'),
    });

    expectError(await cancel(appointment.id), 422, 'APPOINTMENT_ALREADY_CANCELLED');
    expect(ctx.appointments.appointments[0]).toMatchObject({
      cancelledBy: CancelledBy.ADMIN,
      cancelledAt: at(MONDAY, '10:05'),
    });
  });

  it('422 APPOINTMENT_ALREADY_STARTED once startAt <= now', async () => {
    const started = addAppointment(ctx.appointments, {
      clientId: maria.id,
      startAt: at(MONDAY, '10:00'),
      endAt: at(MONDAY, '10:30'),
    });
    const startsNow = addAppointment(ctx.appointments, {
      clientId: maria.id,
      startAt: at(MONDAY, '10:10'),
      endAt: at(MONDAY, '10:40'),
    });

    expectError(await cancel(started.id), 422, 'APPOINTMENT_ALREADY_STARTED');
    expectError(await cancel(startsNow.id), 422, 'APPOINTMENT_ALREADY_STARTED');
  });

  it('401 for a visitor and 403 for an admin on the client route', async () => {
    const appointment = future();

    expectError(
      await request(ctx.app).post(`/api/appointments/${appointment.id}/cancel`),
      401,
      'UNAUTHENTICATED',
    );
    expectError(await cancel(appointment.id, adminCookie), 403, 'FORBIDDEN');
  });
});
