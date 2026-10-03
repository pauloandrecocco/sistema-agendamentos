import { AppointmentStatus, Role } from '@agenda/shared';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../src/app.js';
import { createTokenService } from '../../src/lib/jwt.js';
import { hashPassword } from '../../src/lib/password.js';
import type { AppointmentRecord } from '../../src/modules/appointments/appointments.repository.js';
import { AppointmentsService } from '../../src/modules/appointments/appointments.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { AvailabilityService } from '../../src/modules/availability/availability.service.js';
import { FakeTransactionManager } from '../fakes/fake-transaction-manager.js';
import { InMemoryAppointmentRepository } from '../fakes/in-memory-appointment.repository.js';
import {
  InMemoryBlockedDateRepository,
  InMemoryScheduleRepository,
} from '../fakes/in-memory-schedule.repository.js';
import { InMemoryUserRepository } from '../fakes/in-memory-user.repository.js';

export const TEST_JWT_SECRET = 'test-secret';

/** Default frozen "now": Monday 2026-10-05 08:00 in São Paulo (before the first slot). */
export const DEFAULT_NOW = new Date('2026-10-05T11:00:00.000Z');

export function buildTestApp(options: { now?: Date } = {}) {
  const users = new InMemoryUserRepository();
  const schedule = new InMemoryScheduleRepository();
  const blockedDates = new InMemoryBlockedDateRepository();
  const appointments = new InMemoryAppointmentRepository();
  const clock = { now: options.now ?? DEFAULT_NOW };
  const tokenService = createTokenService({ secret: TEST_JWT_SECRET, expiresIn: '8h' });
  const now = () => clock.now;
  const repos = { schedule, blockedDates, appointments };

  const app = createApp({
    appointmentsService: new AppointmentsService({
      transactions: new FakeTransactionManager(repos),
      appointments,
      clock: now,
    }),
    authService: new AuthService(users),
    availabilityService: new AvailabilityService({ ...repos, clock: now }),
    tokenService,
    cookieSecure: false,
  });
  return { app, users, schedule, blockedDates, appointments, clock, tokenService };
}

/** Inserts a user straight into the fake repository (e.g. the seeded admin). */
export async function addUser(
  users: InMemoryUserRepository,
  data: { email: string; password: string; role?: Role; name?: string; phone?: string | null },
) {
  return users.create({
    name: data.name ?? 'Usuário Teste',
    email: data.email,
    phone: data.phone ?? null,
    passwordHash: await hashPassword(data.password),
    role: data.role ?? Role.CLIENT,
  });
}

/** Inserts an appointment straight into the fake repository (CONFIRMED by default). */
export function addAppointment(
  appointments: InMemoryAppointmentRepository,
  data: Partial<AppointmentRecord> & { startAt: Date; endAt: Date },
): AppointmentRecord {
  const appointment: AppointmentRecord = {
    id: randomUUID(),
    clientId: randomUUID(),
    status: AppointmentStatus.CONFIRMED,
    cancelledBy: null,
    cancelledAt: null,
    createdAt: new Date('2026-09-01T12:00:00.000Z'),
    ...data,
  };
  appointments.appointments.push(appointment);
  return appointment;
}

/** Extracts the access_token cookie (name=value) from a Set-Cookie header, ready for `.set('Cookie', …)`. */
export function getSessionCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith('access_token='));
  if (!cookie) throw new Error('access_token cookie not set');
  return cookie.split(';')[0]!;
}

/** Session cookie for a user, signed like the login does (skips the bcrypt round trip). */
export function sessionCookieFor(
  tokenService: ReturnType<typeof createTokenService>,
  user: { id: string; role: Role },
): string {
  return `access_token=${tokenService.sign({ userId: user.id, role: user.role }).token}`;
}
