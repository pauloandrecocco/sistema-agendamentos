/**
 * Manual concurrency check (PRD section 9.4). Requires the API running (npm run dev or Docker).
 * Logs in as a seeded client, finds a free slot and fires two simultaneous POST /appointments for
 * it. Expected: one 201 and one 409. The created appointment is cancelled at the end, so the slot
 * is free again (the record stays as CANCELLED, appointments are never deleted).
 */
import {
  DayAvailabilityStatus,
  addDaysToDate,
  getMonthDates,
  toBusinessDate,
  type AppointmentResponse,
  type AvailabilityCalendarResponse,
  type AvailabilityResponse,
} from '@agenda/shared';

const baseUrl = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? '3333'}/api`;
const credentials = { email: 'maria@email.com', password: 'cliente123' };

async function call(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (init.cookie) headers.set('Cookie', init.cookie);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function login(): Promise<string> {
  const res = await call('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
  if (res.status !== 200) throw new Error(`Login failed with HTTP ${res.status}`);
  const cookie = res.headers.getSetCookie().find((value) => value.startsWith('access_token='));
  if (!cookie) throw new Error('Login did not set the access_token cookie');
  return cookie.split(';')[0]!;
}

/** First free slot in the current or the next month (business timezone). */
async function findFreeSlot(): Promise<string> {
  const currentMonth = toBusinessDate(new Date()).slice(0, 7);
  const nextMonth = addDaysToDate(getMonthDates(currentMonth).at(-1)!, 1).slice(0, 7);

  for (const month of [currentMonth, nextMonth]) {
    const calendar = (await (
      await call(`/availability/calendar?month=${month}`)
    ).json()) as AvailabilityCalendarResponse;
    for (const day of calendar.days) {
      if (day.status !== DayAvailabilityStatus.AVAILABLE) continue;
      const availability = (await (
        await call(`/availability?date=${day.date}`)
      ).json()) as AvailabilityResponse;
      const slot = availability.slots[0];
      if (slot) return slot.startAt;
    }
  }
  throw new Error('No free slot found in the current or next month');
}

async function main() {
  console.log(`API: ${baseUrl}`);
  const cookie = await login();
  const startAt = await findFreeSlot();
  console.log(`Free slot: ${startAt}. Firing 2 simultaneous POST /appointments...`);

  const body = JSON.stringify({ startAt });
  const responses = await Promise.all([
    call('/appointments', { method: 'POST', body, cookie }),
    call('/appointments', { method: 'POST', body, cookie }),
  ]);
  const results = await Promise.all(
    responses.map(async (res) => ({ status: res.status, body: await res.json() })),
  );
  results.forEach((result, index) => {
    console.log(`  request ${index + 1}: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  });

  const created = results.find((result) => result.status === 201);
  if (created) {
    const { appointment } = created.body as AppointmentResponse;
    const res = await call(`/appointments/${appointment.id}/cancel`, { method: 'POST', cookie });
    console.log(`Cleanup: cancelled ${appointment.id} (HTTP ${res.status})`);
  }

  const statuses = results.map((result) => result.status).sort();
  const ok = statuses[0] === 201 && statuses[1] === 409;
  console.log(
    ok ? 'OK: one 201 and one 409.' : `FAIL: expected [201, 409], got [${statuses.join(', ')}]`,
  );
  process.exitCode = ok ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error('Concurrency check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
