import { describe, expect, it } from 'vitest';
import {
  appointmentIdParamsSchema,
  createAppointmentSchema,
  myAppointmentsQuerySchema,
} from './appointments.js';

describe('createAppointmentSchema', () => {
  it('accepts UTC or an offset and normalizes to the same instant', () => {
    const utc = createAppointmentSchema.parse({ startAt: '2026-10-05T12:00:00.000Z' });
    const offset = createAppointmentSchema.parse({ startAt: '2026-10-05T09:00:00-03:00' });
    expect(utc.startAt.toISOString()).toBe('2026-10-05T12:00:00.000Z');
    expect(offset.startAt).toEqual(utc.startAt);
  });

  it('rejects missing, local-only or malformed values', () => {
    for (const startAt of [undefined, '2026-10-05T09:00:00', '2026-10-05', 'amanhã', 123]) {
      expect(createAppointmentSchema.safeParse({ startAt }).success).toBe(false);
    }
  });
});

describe('myAppointmentsQuerySchema', () => {
  it('defaults to upcoming and accepts history', () => {
    expect(myAppointmentsQuerySchema.parse({})).toEqual({ scope: 'upcoming' });
    expect(myAppointmentsQuerySchema.parse({ scope: 'history' })).toEqual({ scope: 'history' });
    expect(myAppointmentsQuerySchema.safeParse({ scope: 'all' }).success).toBe(false);
  });
});

describe('appointmentIdParamsSchema', () => {
  it('requires a uuid', () => {
    expect(
      appointmentIdParamsSchema.safeParse({ id: '6f1c1b4e-3f5a-4a61-9a39-0b6f3c1d2e4f' }).success,
    ).toBe(true);
    expect(appointmentIdParamsSchema.safeParse({ id: '123' }).success).toBe(false);
  });
});
