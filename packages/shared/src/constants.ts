/** Business timezone: every `YYYY-MM-DD` date and `HH:mm` time is interpreted in it. */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

/** Allowed slot durations, in minutes. */
export const SLOT_DURATIONS = [30, 60] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];
