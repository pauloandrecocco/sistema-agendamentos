import { describe, expect, it } from 'vitest';
import { TIME_OPTIONS } from '../constants.js';
import { minutesToTime, timeToMinutes } from './time.js';

describe('timeToMinutes / minutesToTime', () => {
  it('converts both ways', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:30')).toBe(1410);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(60)).toBe('01:00');
  });

  it('TIME_OPTIONS lists every half hour from 00:00 to 23:30', () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toBe('00:00');
    expect(TIME_OPTIONS[19]).toBe('09:30');
    expect(TIME_OPTIONS.at(-1)).toBe('23:30');
  });
});
