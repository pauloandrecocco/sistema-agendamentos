import { describe, expect, it } from 'vitest';
import { AppointmentStatus, DisplayStatus } from '../enums.js';
import { getDisplayStatus } from './status.js';

const now = new Date('2026-10-05T13:00:00.000Z');

describe('getDisplayStatus (RN-09)', () => {
  it('future CONFIRMED stays CONFIRMED', () => {
    const startAt = new Date('2026-10-05T13:30:00.000Z');
    expect(getDisplayStatus({ status: AppointmentStatus.CONFIRMED, startAt }, now)).toBe(
      DisplayStatus.CONFIRMED,
    );
  });

  it('past CONFIRMED is COMPLETED', () => {
    const startAt = new Date('2026-10-05T12:00:00.000Z');
    expect(getDisplayStatus({ status: AppointmentStatus.CONFIRMED, startAt }, now)).toBe(
      DisplayStatus.COMPLETED,
    );
  });

  it('CONFIRMED starting exactly now is COMPLETED', () => {
    expect(getDisplayStatus({ status: AppointmentStatus.CONFIRMED, startAt: now }, now)).toBe(
      DisplayStatus.COMPLETED,
    );
  });

  it('CANCELLED is always CANCELLED', () => {
    for (const startAt of [
      new Date('2026-10-04T12:00:00.000Z'),
      new Date('2026-10-06T12:00:00.000Z'),
    ]) {
      expect(getDisplayStatus({ status: AppointmentStatus.CANCELLED, startAt }, now)).toBe(
        DisplayStatus.CANCELLED,
      );
    }
  });
});
