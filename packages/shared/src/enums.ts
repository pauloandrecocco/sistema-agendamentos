export const Role = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Persisted appointment status. "Completed" is derived, never stored. */
export const AppointmentStatus = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const CancelledBy = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
} as const;
export type CancelledBy = (typeof CancelledBy)[keyof typeof CancelledBy];

/** Status shown to users (RN-09): COMPLETED is derived from CONFIRMED + startAt <= now. */
export const DisplayStatus = {
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type DisplayStatus = (typeof DisplayStatus)[keyof typeof DisplayStatus];

/** State of a day in the public availability calendar (RF-02). */
export const DayAvailabilityStatus = {
  AVAILABLE: 'AVAILABLE',
  NO_SLOTS: 'NO_SLOTS',
  CLOSED: 'CLOSED',
  BLOCKED: 'BLOCKED',
  PAST: 'PAST',
} as const;
export type DayAvailabilityStatus =
  (typeof DayAvailabilityStatus)[keyof typeof DayAvailabilityStatus];
