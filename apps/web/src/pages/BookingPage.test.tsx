// @vitest-environment jsdom
import '@/test/setup-dom';
import {
  DayAvailabilityStatus,
  type AvailabilityCalendarResponse,
  type AvailabilityResponse,
} from '@agenda/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/AppRoutes';

// A fixed future date in the URL: the page keeps using the real clock (never faked), and nothing
// asserted here depends on today's date or on the machine timezone.
const DATE = '2030-06-10';
const SLOT_START = '2030-06-10T12:00:00.000Z'; // 09:00 in São Paulo

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Fake API for a visitor: no session, one free slot on DATE. */
function fakeApi(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
  if (url.pathname === '/api/auth/me') {
    return Promise.resolve(
      json(401, { error: { code: 'UNAUTHENTICATED', message: 'Não autenticado.' } }),
    );
  }
  if (url.pathname === '/api/availability/calendar') {
    const body: AvailabilityCalendarResponse = {
      month: url.searchParams.get('month')!,
      days: [{ date: DATE, status: DayAvailabilityStatus.AVAILABLE }],
    };
    return Promise.resolve(json(200, body));
  }
  if (url.pathname === '/api/availability' && url.searchParams.get('date') === DATE) {
    const body: AvailabilityResponse = {
      date: DATE,
      slotDurationMinutes: 30,
      slots: [{ startAt: SLOT_START, endAt: '2030-06-10T12:30:00.000Z' }],
    };
    return Promise.resolve(json(200, body));
  }
  return Promise.resolve(json(404, { error: { code: 'NOT_FOUND', message: 'Não encontrado.' } }));
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('/agendar as a visitor', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(fakeApi));
    // BookingPage checks the screen width when a day is picked; jsdom has no matchMedia.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the visitor to the login with a redirect back to the chosen slot', async () => {
    const user = userEvent.setup();
    renderApp(`/agendar?date=${DATE}`);

    await user.click(await screen.findByRole('button', { name: '09:00' }));

    expect(await screen.findByText('Acesse com seu e-mail e senha.')).toBeInTheDocument();
    // redirect = encodeURIComponent('/agendar?date=2030-06-10&slot=2030-06-10T12%3A00%3A00.000Z')
    expect(screen.getByTestId('location').textContent).toBe(
      '/login?redirect=%2Fagendar%3Fdate%3D2030-06-10%26slot%3D2030-06-10T12%253A00%253A00.000Z',
    );
  });
});
