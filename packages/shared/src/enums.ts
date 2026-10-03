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
