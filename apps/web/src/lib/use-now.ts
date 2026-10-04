import { useSyncExternalStore } from 'react';
import { getBusinessToday } from './format';

/** How often the screens re-check the time (status of appointments, "today"). */
const NOW_INTERVAL_MS = 30_000;

/**
 * One shared clock for every component: a single interval while anything is subscribed. Also
 * ticks when the tab becomes visible again, since browsers throttle timers in background tabs.
 */
let now = new Date();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  now = new Date();
  for (const listener of listeners) listener();
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') tick();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    timer = setInterval(tick, NOW_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

function getSnapshot(): Date {
  return now;
}

/**
 * Current instant, refreshed about every 30 s. Only for what the screen shows: the server stays
 * the final check (e.g. 422 APPOINTMENT_ALREADY_STARTED).
 */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Today's date in the business timezone, following `useNow` (changes at local midnight). */
export function useBusinessToday(): string {
  return getBusinessToday(useNow());
}
