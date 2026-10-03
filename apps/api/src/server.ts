import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { systemClock } from './lib/clock.js';
import { createTokenService } from './lib/jwt.js';
import { createPrismaClient } from './lib/prisma.js';
import { PrismaTransactionManager, createRepositories } from './lib/transaction-manager.js';
import { AdminService } from './modules/admin/admin.service.js';
import { AppointmentsService } from './modules/appointments/appointments.service.js';
import { PrismaUserRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AvailabilityService } from './modules/availability/availability.service.js';
import { ScheduleService } from './modules/schedule/schedule.service.js';

const env = loadEnv();
const prisma = createPrismaClient(env.DATABASE_URL);
const repositories = createRepositories(prisma);
const transactions = new PrismaTransactionManager(prisma);

const app = createApp({
  adminService: new AdminService({ ...repositories, clock: systemClock }),
  appointmentsService: new AppointmentsService({
    transactions,
    appointments: repositories.appointments,
    clock: systemClock,
  }),
  authService: new AuthService(new PrismaUserRepository(prisma)),
  availabilityService: new AvailabilityService({ ...repositories, clock: systemClock }),
  scheduleService: new ScheduleService({ ...repositories, transactions, clock: systemClock }),
  tokenService: createTokenService({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }),
  cookieSecure: env.COOKIE_SECURE,
});

const server = app.listen(env.API_PORT, () => {
  console.log(`API listening on port ${env.API_PORT}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
