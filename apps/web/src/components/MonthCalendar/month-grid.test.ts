import { describe, expect, it } from 'vitest';
import { buildMonthGrid } from './month-grid';

describe('buildMonthGrid', () => {
  it('starts on the weekday of the 1st (October 2026 starts on Thursday)', () => {
    const weeks = buildMonthGrid('2026-10');
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks).toHaveLength(5);
    expect(weeks.at(-1)?.at(-1)).toBe('2026-10-31');
  });

  it('has no leading padding when the month starts on Sunday (November 2026)', () => {
    const weeks = buildMonthGrid('2026-11');
    expect(weeks[0]?.[0]).toBe('2026-11-01');
    expect(weeks.at(-1)).toEqual(['2026-11-29', '2026-11-30', null, null, null, null, null]);
  });

  it('spans 6 weeks when a 31-day month starts on Saturday (August 2026)', () => {
    const weeks = buildMonthGrid('2026-08');
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-08-01']);
    expect(weeks).toHaveLength(6);
  });

  it('includes Feb 29 in a leap year', () => {
    const dates = buildMonthGrid('2028-02').flat().filter(Boolean);
    expect(dates).toHaveLength(29);
    expect(dates.at(-1)).toBe('2028-02-29');
  });

  it('every week has 7 cells', () => {
    for (const week of buildMonthGrid('2026-10')) expect(week).toHaveLength(7);
  });
});
