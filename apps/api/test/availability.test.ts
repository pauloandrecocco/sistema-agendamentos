import {
  AppointmentStatus,
  CancelledBy,
  businessDateTimeToInstant,
  type AvailabilityCalendarResponse,
  type AvailabilityResponse,
} from '@agenda/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { addAppointment, buildTestApp } from './helpers/build-test-app.js';

const MONDAY = '2026-10-05';
const TUESDAY = '2026-10-06';
const at = (date: string, time: string) => businessDateTimeToInstant(date, time);

let ctx: ReturnType<typeof buildTestApp>;

beforeEach(() => {
  ctx = buildTestApp({ now: at(MONDAY, '10:10') });
});

describe('GET /api/availability?date=', () => {
  it('lists the free slots of the day as ISO UTC instants', async () => {
    const res = await request(ctx.app).get('/api/availability').query({ date: TUESDAY });

    expect(res.status).toBe(200);
    expect(res.body.date).toBe(TUESDAY);
    expect(res.body.slotDurationMinutes).toBe(30);
    expect(res.body.slots).toHaveLength(18);
    expect(res.body.slots[0]).toEqual({
      startAt: '2026-10-06T12:00:00.000Z',
      endAt: '2026-10-06T12:30:00.000Z',
    });
    const { slots } = res.body as AvailabilityResponse;
    expect(slots.at(-1)?.startAt).toBe('2026-10-06T20:30:00.000Z');
  });

  it('only lists slots after now on the current day', async () => {
    const res = await request(ctx.app).get('/api/availability').query({ date: MONDAY });

    expect(res.body.slots[0].startAt).toBe(at(MONDAY, '10:30').toISOString());
  });

  it('hides slots overlapping CONFIRMED appointments, not cancelled ones', async () => {
    addAppointment(ctx.appointments, {
      startAt: at(TUESDAY, '09:00'),
      endAt: at(TUESDAY, '09:30'),
    });
    addAppointment(ctx.appointments, {
      startAt: at(TUESDAY, '09:30'),
      endAt: at(TUESDAY, '10:00'),
      status: AppointmentStatus.CANCELLED,
      cancelledBy: CancelledBy.CLIENT,
      cancelledAt: at(MONDAY, '08:00'),
    });

    const res = await request(ctx.app).get('/api/availability').query({ date: TUESDAY });

    expect(res.body.slots[0].startAt).toBe(at(TUESDAY, '09:30').toISOString());
    expect(res.body.slots).toHaveLength(17);
  });

  it('respects the current slot duration', async () => {
    ctx.schedule.config.slotDurationMinutes = 60;

    const res = await request(ctx.app).get('/api/availability').query({ date: TUESDAY });

    expect(res.body.slotDurationMinutes).toBe(60);
    expect(res.body.slots).toHaveLength(9);
    expect(res.body.slots[0].endAt).toBe(at(TUESDAY, '10:00').toISOString());
  });

  it('returns no slots for a blocked, closed or past day', async () => {
    ctx.blockedDates.dates.add(TUESDAY);

    for (const date of [TUESDAY, '2026-10-11', '2026-10-02']) {
      const res = await request(ctx.app).get('/api/availability').query({ date });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ date, slotDurationMinutes: 30, slots: [] });
    }
  });

  it('rejects a missing or invalid date with 400 VALIDATION_ERROR', async () => {
    for (const query of [{}, { date: '2026-02-30' }, { date: '05/10/2026' }]) {
      const res = await request(ctx.app).get('/api/availability').query(query);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty('date');
    }
  });
});

describe('GET /api/availability/calendar?month=', () => {
  it('returns the state of every day of the month', async () => {
    ctx.blockedDates.dates.add('2026-10-08');

    const res = await request(ctx.app)
      .get('/api/availability/calendar')
      .query({ month: '2026-10' });

    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-10');
    expect(res.body.days).toHaveLength(31);
    const { days } = res.body as AvailabilityCalendarResponse;
    const statusOf = (date: string) => days.find((day) => day.date === date)?.status;
    expect(statusOf('2026-10-01')).toBe('PAST');
    expect(statusOf(MONDAY)).toBe('AVAILABLE');
    expect(statusOf('2026-10-08')).toBe('BLOCKED');
    expect(statusOf('2026-10-11')).toBe('CLOSED');
  });

  it('marks a past month as PAST', async () => {
    const res = await request(ctx.app)
      .get('/api/availability/calendar')
      .query({ month: '2026-09' });

    expect(res.status).toBe(200);
    const { days } = res.body as AvailabilityCalendarResponse;
    expect(days.every((day) => day.status === 'PAST')).toBe(true);
  });

  it('rejects an invalid month with 400 VALIDATION_ERROR', async () => {
    const res = await request(ctx.app)
      .get('/api/availability/calendar')
      .query({ month: '2026-13' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is public (no session needed)', async () => {
    const res = await request(ctx.app)
      .get('/api/availability/calendar')
      .query({ month: '2026-10' });
    expect(res.status).toBe(200);
  });
});
