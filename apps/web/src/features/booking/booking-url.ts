import type { SlotDto } from '@agenda/shared';
import { withRedirect } from '@/lib/redirect';

/** "/agendar?date=YYYY-MM-DD[&slot=<startAt>]": the booking page restores its state from it. */
export function buildBookingPath(date: string, slotStartAt?: string): string {
  const params = new URLSearchParams({ date });
  if (slotStartAt) params.set('slot', slotStartAt);
  return `/agendar?${params.toString()}`;
}

/** RF-04: a visitor who picks a slot logs in and comes back to confirm that same slot. */
export function buildSlotLoginPath(date: string, slotStartAt: string): string {
  return withRedirect('/login', buildBookingPath(date, slotStartAt));
}

/** The slot starting at `startAt` (compared as instants, so "…Z" and "…-03:00" match), if free. */
export function findSlot(slots: readonly SlotDto[], startAt: string): SlotDto | undefined {
  const time = new Date(startAt).getTime();
  if (Number.isNaN(time)) return undefined;
  return slots.find((slot) => new Date(slot.startAt).getTime() === time);
}
