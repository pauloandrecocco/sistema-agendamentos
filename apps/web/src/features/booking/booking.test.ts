import { describe, expect, it } from 'vitest';
import { getSafeRedirect } from '@/lib/redirect';
import { buildBookingPath, buildSlotLoginPath, findSlot } from './booking-url';
import { getAvailabilityDayState } from './day-state';

const SLOT = '2026-10-05T17:00:00.000Z';

describe('booking URLs', () => {
  it('keeps date and slot in the booking path', () => {
    expect(buildBookingPath('2026-10-05')).toBe('/agendar?date=2026-10-05');
    expect(buildBookingPath('2026-10-05', SLOT)).toBe(
      '/agendar?date=2026-10-05&slot=2026-10-05T17%3A00%3A00.000Z',
    );
  });

  it('sends a visitor to login with a redirect back to the chosen slot', () => {
    const path = buildSlotLoginPath('2026-10-05', SLOT);
    const url = new URL(path, 'http://localhost');

    expect(url.pathname).toBe('/login');
    const redirect = url.searchParams.get('redirect');
    expect(getSafeRedirect(redirect)).toBe(redirect);

    const back = new URL(redirect!, 'http://localhost');
    expect(back.pathname).toBe('/agendar');
    expect(back.searchParams.get('date')).toBe('2026-10-05');
    expect(back.searchParams.get('slot')).toBe(SLOT);
  });
});

describe('findSlot', () => {
  const slots = [
    { startAt: '2026-10-05T12:00:00.000Z', endAt: '2026-10-05T12:30:00.000Z' },
    { startAt: SLOT, endAt: '2026-10-05T17:30:00.000Z' },
  ];

  it('matches the same instant in any ISO format', () => {
    expect(findSlot(slots, SLOT)).toBe(slots[1]);
    expect(findSlot(slots, '2026-10-05T14:00:00-03:00')).toBe(slots[1]);
  });

  it('is undefined for a taken or invalid slot', () => {
    expect(findSlot(slots, '2026-10-05T18:00:00.000Z')).toBeUndefined();
    expect(findSlot(slots, 'not-a-date')).toBeUndefined();
  });
});

describe('getAvailabilityDayState', () => {
  it('only AVAILABLE days are clickable', () => {
    expect(getAvailabilityDayState('AVAILABLE').disabled).toBe(false);
    for (const status of ['NO_SLOTS', 'CLOSED', 'BLOCKED', 'PAST'] as const) {
      expect(getAvailabilityDayState(status).disabled).toBe(true);
    }
    expect(getAvailabilityDayState(undefined).disabled).toBe(true);
  });
});
