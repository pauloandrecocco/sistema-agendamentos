import type { ScheduleConfig, WorkingHours } from '@agenda/shared';

/** Same configuration as the seed: Mon-Fri 09:00-18:00, Sat 09:00-13:00, Sun closed. */
export function defaultScheduleConfig(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  const workingHours: WorkingHours[] = [
    { weekday: 0, isActive: false, startTime: '09:00', endTime: '18:00' },
    { weekday: 1, isActive: true, startTime: '09:00', endTime: '18:00' },
    { weekday: 2, isActive: true, startTime: '09:00', endTime: '18:00' },
    { weekday: 3, isActive: true, startTime: '09:00', endTime: '18:00' },
    { weekday: 4, isActive: true, startTime: '09:00', endTime: '18:00' },
    { weekday: 5, isActive: true, startTime: '09:00', endTime: '18:00' },
    { weekday: 6, isActive: true, startTime: '09:00', endTime: '13:00' },
  ];
  return { slotDurationMinutes: 30, workingHours, ...overrides };
}

/** Every weekday active with the same interval (handy for engine cases). */
export function uniformScheduleConfig(
  startTime: string,
  endTime: string,
  slotDurationMinutes = 30,
): ScheduleConfig {
  return {
    slotDurationMinutes,
    workingHours: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      isActive: true,
      startTime,
      endTime,
    })),
  };
}
