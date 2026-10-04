// @vitest-environment jsdom
import '@/test/setup-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MonthCalendar, type DayState } from './MonthCalendar';

// "Now" is injected through props (`month`, `today`): the global clock is never faked.
const MONTH = '2026-10';
const TODAY = '2026-10-05';

const AVAILABLE: DayState = { disabled: false, tone: 'available' };
const CLOSED: DayState = { disabled: true, tone: 'unavailable', label: 'Fechado' };

/** Day button by its day of the month (the accessible name starts with the long date). */
function day(dayOfMonth: number) {
  return screen.getByRole('button', { name: new RegExp(`^\\S+, ${dayOfMonth} de outubro`) });
}

function pressedDays(): number[] {
  return screen
    .getAllByRole('button', { pressed: true })
    .map((button) => Number(button.textContent));
}

describe('MonthCalendar: disabled days', () => {
  it('disables the days whose state says so and selects only the enabled ones', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        mode="single"
        month={MONTH}
        onMonthChange={() => {}}
        today={TODAY}
        selected={null}
        onSelect={onSelect}
        getDayState={(date) => (date < TODAY || date === '2026-10-11' ? CLOSED : AVAILABLE)}
      />,
    );

    expect(day(4)).toBeDisabled();
    expect(day(11)).toBeDisabled();
    expect(day(11)).toHaveAccessibleName(/Fechado$/);
    expect(day(5)).toBeEnabled();

    await user.click(day(11));
    expect(onSelect).not.toHaveBeenCalled();

    await user.click(day(12));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('2026-10-12');
  });

  it('disables every day while the month loads', () => {
    render(
      <MonthCalendar
        mode="single"
        month={MONTH}
        onMonthChange={() => {}}
        today={TODAY}
        selected={null}
        onSelect={() => {}}
        isLoading
      />,
    );

    const days = screen.getAllByRole('button', { name: /de outubro/ });
    expect(days).toHaveLength(31);
    for (const button of days) expect(button).toBeDisabled();
  });
});

describe('MonthCalendar: multi mode', () => {
  function MultiCalendar({ initial = [] }: { initial?: string[] }) {
    const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(initial));
    return (
      <MonthCalendar
        mode="multi"
        month={MONTH}
        onMonthChange={() => {}}
        today={TODAY}
        selected={selected}
        onSelectionChange={setSelected}
        getDayState={(date) => (date === '2026-10-12' ? CLOSED : AVAILABLE)}
      />
    );
  }

  it('selects the dragged range, leaving out disabled days', async () => {
    const user = userEvent.setup();
    render(<MultiCalendar initial={['2026-10-20']} />);

    await user.pointer([
      { keys: '[MouseLeft>]', target: day(10) },
      { target: day(11) },
      { target: day(12) },
      { target: day(13) },
      { target: day(14) },
      { keys: '[/MouseLeft]', target: day(14) },
    ]);

    // The previous selection is kept; the 12th is closed.
    expect(pressedDays()).toEqual([10, 11, 13, 14, 20]);
  });

  it('keeps the anchor selected when a drag returns and ends on it', async () => {
    const user = userEvent.setup();
    render(<MultiCalendar />);

    await user.pointer([
      { keys: '[MouseLeft>]', target: day(10) },
      { target: day(11) },
      { target: day(10) },
      { keys: '[/MouseLeft]', target: day(10) },
    ]);

    // The range shrank back to the anchor; the click fired by the release does not toggle it off.
    expect(pressedDays()).toEqual([10]);
  });

  it('toggles a day on click', async () => {
    const user = userEvent.setup();
    render(<MultiCalendar />);

    await user.click(day(15));
    expect(pressedDays()).toEqual([15]);

    await user.click(day(15));
    expect(screen.queryAllByRole('button', { pressed: true })).toEqual([]);
  });
});
