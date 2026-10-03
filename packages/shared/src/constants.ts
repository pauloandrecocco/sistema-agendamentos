/** Business timezone: every `YYYY-MM-DD` date and `HH:mm` time is interpreted in it. */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo';

/** Allowed slot durations, in minutes. */
export const SLOT_DURATIONS = [30, 60] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

/** Every half hour of the day, "00:00" ... "23:30" (options for the working hours selects). */
export const TIME_OPTIONS: readonly string[] = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hours}:${index % 2 === 0 ? '00' : '30'}`;
});
