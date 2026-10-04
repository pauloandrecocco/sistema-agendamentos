import {
  AppointmentStatus,
  CancelledBy,
  Role,
  businessDateTimeToInstant,
  type AdminCalendarResponse,
  type AppointmentDto,
  type ScheduleConfigInput,
} from '@agenda/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppointmentRecord } from '../src/modules/appointments/appointments.repository.js';
import { defaultScheduleConfig } from './fixtures/schedule.js';
import {
  addAppointment,
  addUser,
  buildTestApp,
  sessionCookieFor,
} from './helpers/build-test-app.js';

// Frozen now: Monday 2026-10-05 10:10 in São Paulo.
const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const WEDNESDAY = '2026-10-07';
const at = (date: string, time: string) => businessDateTimeToInstant(date, time);
const NOW = at(MONDAY, '10:10');

let ctx: ReturnType<typeof buildTestApp>;
let clientId: string;
let mariaCookie: string;
let adminCookie: string;

beforeEach(async () => {
  ctx = buildTestApp({ now: NOW });
  const maria = await addUser(ctx.users, { email: 'maria@email.com', password: 'cliente123' });
  const admin = await addUser(ctx.users, {
    email: 'admin@agenda.com',
    password: 'admin123',
    role: Role.ADMIN,
  });
  clientId = maria.id;
  mariaCookie = sessionCookieFor(ctx.tokenService, maria);
  adminCookie = sessionCookieFor(ctx.tokenService, admin);
});

function book(date: string, time: string, extra: Partial<AppointmentRecord> = {}) {
  const startAt = at(date, time);
  return addAppointment(ctx.appointments, {
    clientId,
    startAt,
    endAt: new Date(startAt.getTime() + 30 * 60_000),
    ...extra,
  });
}

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
  expect(res.body.error.message).toEqual(expect.any(String));
}

describe('GET/PUT /api/admin/schedule', () => {
  function put(body: unknown) {
    return request(ctx.app)
      .put('/api/admin/schedule')
      .set('Cookie', adminCookie)
      .send(body as object);
  }

  function validBody(): ScheduleConfigInput {
    return defaultScheduleConfig();
  }

  it('returns the current configuration', async () => {
    const res = await request(ctx.app).get('/api/admin/schedule').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(defaultScheduleConfig());
  });

  it('saves duration and weekly hours, and the new slots apply immediately', async () => {
    const body = validBody();
    body.slotDurationMinutes = 60;
    body.workingHours[0] = { weekday: 0, isActive: true, startTime: '10:00', endTime: '12:00' };

    const res = await put(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(body);
    expect(ctx.schedule.config).toEqual(body);

    const sunday = await request(ctx.app).get('/api/availability?date=2026-10-11');
    expect(sunday.body.slotDurationMinutes).toBe(60);
    expect(sunday.body.slots).toHaveLength(2);
  });

  it('does not change existing appointments (RN-10)', async () => {
    book(TUESDAY, '09:30');
    book(WEDNESDAY, '17:30');
    const before = structuredClone(ctx.appointments.appointments);
    const body = validBody();
    body.slotDurationMinutes = 60;
    body.workingHours[2] = { weekday: 2, isActive: false, startTime: '09:00', endTime: '18:00' };
    body.workingHours[3] = { weekday: 3, isActive: true, startTime: '13:00', endTime: '15:00' };

    expect((await put(body)).status).toBe(200);
    expect(ctx.appointments.appointments).toEqual(before);
  });

  it('keeps appointments of a day that became closed visible to the admin (RN-10)', async () => {
    const tuesday = book(TUESDAY, '09:30');
    const body = validBody();
    body.workingHours[2] = { weekday: 2, isActive: false, startTime: '09:00', endTime: '18:00' };
    expect((await put(body)).status).toBe(200);

    const calendar = await request(ctx.app)
      .get('/api/admin/calendar?month=2026-10')
      .set('Cookie', adminCookie);
    const days = (calendar.body as AdminCalendarResponse).days;
    expect(days.find((day) => day.date === TUESDAY)).toMatchObject({
      appointmentsCount: 1,
      isClosed: true,
    });

    const summary = await request(ctx.app).get('/api/admin/summary').set('Cookie', adminCookie);
    expect(summary.body).toEqual({ today: 0, next7Days: 1 });

    const list = await request(ctx.app)
      .get(`/api/admin/appointments?from=${TUESDAY}&to=${TUESDAY}`)
      .set('Cookie', adminCookie);
    expect(list.body.items).toEqual([
      expect.objectContaining({ id: tuesday.id, displayStatus: 'CONFIRMED' }),
    ]);
  });

  it('400 for an invalid duration, misaligned time, end <= start or missing/repeated weekday', async () => {
    const cases: [string, (body: ScheduleConfigInput) => void, string][] = [
      ['duration 45', (body) => (body.slotDurationMinutes = 45), 'slotDurationMinutes'],
      ['09:15', (body) => (body.workingHours[1]!.startTime = '09:15'), 'workingHours.1.startTime'],
      [
        'end = start',
        (body) => (body.workingHours[1]!.endTime = '09:00'),
        'workingHours.1.endTime',
      ],
      [
        'inactive end < start',
        (body) => (body.workingHours[0]!.endTime = '08:00'),
        'workingHours.0.endTime',
      ],
      ['6 days', (body) => body.workingHours.pop(), 'workingHours'],
      ['repeated weekday', (body) => (body.workingHours[6]!.weekday = 5), 'workingHours'],
    ];
    for (const [name, mutate, field] of cases) {
      const body = validBody();
      mutate(body);
      const res = await put(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(Object.keys(res.body.error.details), name).toContain(field);
    }
    expect(ctx.schedule.config).toEqual(defaultScheduleConfig());
  });
});

describe('POST /api/admin/blocked-dates', () => {
  function block(dates: string[]) {
    return request(ctx.app)
      .post('/api/admin/blocked-dates')
      .set('Cookie', adminCookie)
      .send({ dates });
  }

  it('blocks the dates and cancels only their future CONFIRMED appointments (RN-11)', async () => {
    const startedToday = book(MONDAY, '09:00');
    const laterToday = book(MONDAY, '14:00');
    const tuesday = book(TUESDAY, '10:00');
    const tuesdayNight = book(TUESDAY, '22:00'); // 01:00Z on Wednesday, Tuesday in São Paulo
    const alreadyCancelled = book(TUESDAY, '11:00', {
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.CLIENT,
      cancelledAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    const otherDay = book(WEDNESDAY, '10:00');

    const res = await block([TUESDAY, MONDAY, TUESDAY]);

    expect(res.status).toBe(200);
    expect(res.body.blockedDates).toEqual([MONDAY, TUESDAY]);
    const cancelled = res.body.cancelledAppointments as AppointmentDto[];
    expect(cancelled.map((item) => item.id).sort()).toEqual(
      [laterToday.id, tuesday.id, tuesdayNight.id].sort(),
    );
    for (const item of cancelled) {
      expect(item).toMatchObject({
        status: 'CANCELLED',
        displayStatus: 'CANCELLED',
        cancelledBy: 'ADMIN',
        cancelledAt: NOW.toISOString(),
      });
    }

    const stored = (id: string) => ctx.appointments.appointments.find((item) => item.id === id);
    expect(stored(startedToday.id)?.status).toBe(AppointmentStatus.CONFIRMED);
    expect(stored(otherDay.id)?.status).toBe(AppointmentStatus.CONFIRMED);
    expect(stored(alreadyCancelled.id)).toMatchObject({ cancelledBy: CancelledBy.CLIENT });
    expect([...ctx.blockedDates.dates].sort()).toEqual([MONDAY, TUESDAY]);
  });

  it('keeps an appointment that starts exactly now (startAt == now has started)', async () => {
    const startingNow = book(MONDAY, '10:10');
    const later = book(MONDAY, '10:30');

    const res = await block([MONDAY]);

    expect(res.status).toBe(200);
    expect((res.body.cancelledAppointments as AppointmentDto[]).map((item) => item.id)).toEqual([
      later.id,
    ]);
    expect(ctx.appointments.appointments.find((item) => item.id === startingNow.id)?.status).toBe(
      AppointmentStatus.CONFIRMED,
    );
  });

  it('lists the cancelled appointments in chronological order', async () => {
    // Stored out of order, like the rows of an UPDATE ... RETURNING may come back.
    const wednesday = book(WEDNESDAY, '09:00');
    const tuesdayLate = book(TUESDAY, '15:00');
    const tuesdayEarly = book(TUESDAY, '09:00');
    const mondayNight = book(MONDAY, '22:00');

    const res = await block([WEDNESDAY, TUESDAY, MONDAY]);

    expect((res.body.cancelledAppointments as AppointmentDto[]).map((item) => item.id)).toEqual([
      mondayNight.id,
      tuesdayEarly.id,
      tuesdayLate.id,
      wednesday.id,
    ]);
  });

  it('is idempotent: blocking again cancels nothing new', async () => {
    book(TUESDAY, '10:00');
    expect((await block([TUESDAY])).body.cancelledAppointments).toHaveLength(1);

    const again = await block([TUESDAY]);
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ blockedDates: [TUESDAY], cancelledAppointments: [] });
  });

  it('accepts a day closed by the weekly hours', async () => {
    const res = await block(['2026-10-11']); // Sunday
    expect(res.status).toBe(200);
    expect(ctx.blockedDates.dates.has('2026-10-11')).toBe(true);
  });

  it('422 INVALID_DATE for a past date, without blocking or cancelling anything', async () => {
    const tuesday = book(TUESDAY, '10:00');

    const res = await block(['2026-10-04', TUESDAY]);

    expectError(res, 422, 'INVALID_DATE');
    expect(res.body.error.details).toEqual({ dates: ['2026-10-04'] });
    expect(ctx.blockedDates.dates.size).toBe(0);
    expect(ctx.appointments.appointments[0]?.id).toBe(tuesday.id);
    expect(ctx.appointments.appointments[0]?.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('a blocked day has no slots and cannot be booked', async () => {
    await block([TUESDAY]);

    const day = await request(ctx.app).get(`/api/availability?date=${TUESDAY}`);
    expect(day.body.slots).toEqual([]);

    const booking = await request(ctx.app)
      .post('/api/appointments')
      .set('Cookie', mariaCookie)
      .send({ startAt: at(TUESDAY, '10:00').toISOString() });
    expectError(booking, 422, 'SLOT_NOT_AVAILABLE');
  });

  it('400 for an empty or invalid list', async () => {
    expectError(await block([]), 400, 'VALIDATION_ERROR');
    expectError(await block(['2026-02-30']), 400, 'VALIDATION_ERROR');
  });
});

describe('POST /api/admin/blocked-dates/unblock', () => {
  function unblock(dates: string[]) {
    return request(ctx.app)
      .post('/api/admin/blocked-dates/unblock')
      .set('Cookie', adminCookie)
      .send({ dates });
  }

  it('removes the block but does not restore cancelled appointments (RN-12)', async () => {
    const tuesday = book(TUESDAY, '10:00');
    await request(ctx.app)
      .post('/api/admin/blocked-dates')
      .set('Cookie', adminCookie)
      .send({ dates: [TUESDAY, WEDNESDAY] });

    const res = await unblock([TUESDAY]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unblockedDates: [TUESDAY] });
    expect([...ctx.blockedDates.dates]).toEqual([WEDNESDAY]);
    expect(ctx.appointments.appointments.find((item) => item.id === tuesday.id)).toMatchObject({
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.ADMIN,
    });
  });

  it('is idempotent for a date that is not blocked', async () => {
    const res = await unblock([TUESDAY]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unblockedDates: [TUESDAY] });
  });

  it('accepts today (only dates before today are past)', async () => {
    ctx.blockedDates.dates.add(MONDAY);
    const res = await unblock([MONDAY]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unblockedDates: [MONDAY] });
    expect(ctx.blockedDates.dates.has(MONDAY)).toBe(false);
  });

  it('422 INVALID_DATE for a past date', async () => {
    ctx.blockedDates.dates.add('2026-10-04');
    const res = await unblock(['2026-10-04']);
    expectError(res, 422, 'INVALID_DATE');
    expect(ctx.blockedDates.dates.has('2026-10-04')).toBe(true);
  });
});
