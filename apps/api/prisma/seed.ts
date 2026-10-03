/**
 * Idempotent seed (PRD section 14.4): runs on every API start in Docker.
 * Only inserts what is missing; never overwrites existing users or schedule changes made by the admin.
 * Example appointments are only inserted while the appointments table is empty.
 */
import { Role, addDaysToDate, toBusinessDate } from '@agenda/shared';
import { loadEnv } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';
import { createPrismaClient, type DbClient } from '../src/lib/prisma.js';
import { createRepositories } from '../src/lib/transaction-manager.js';
import { SAMPLE_SEARCH_DAYS, buildSampleAppointments } from './sample-appointments.js';

const DEFAULT_SLOT_DURATION_MINUTES = 30;

const users = [
  {
    name: 'Administrador',
    email: 'admin@agenda.com',
    password: 'admin123',
    phone: null,
    role: Role.ADMIN,
  },
  {
    name: 'Maria Silva',
    email: 'maria@email.com',
    password: 'cliente123',
    phone: '11987654321',
    role: Role.CLIENT,
  },
  {
    name: 'João Souza',
    email: 'joao@email.com',
    password: 'cliente123',
    phone: null,
    role: Role.CLIENT,
  },
];

// 0 = Sunday ... 6 = Saturday. Sunday is inactive but keeps 09:00-18:00 for easy reactivation.
const workingHours = [
  { weekday: 0, isActive: false, startTime: '09:00', endTime: '18:00' },
  { weekday: 1, isActive: true, startTime: '09:00', endTime: '18:00' },
  { weekday: 2, isActive: true, startTime: '09:00', endTime: '18:00' },
  { weekday: 3, isActive: true, startTime: '09:00', endTime: '18:00' },
  { weekday: 4, isActive: true, startTime: '09:00', endTime: '18:00' },
  { weekday: 5, isActive: true, startTime: '09:00', endTime: '18:00' },
  { weekday: 6, isActive: true, startTime: '09:00', endTime: '13:00' },
];

/** Inserts the example appointments only when there are none yet. Returns how many were created. */
async function seedSampleAppointments(prisma: DbClient): Promise<number> {
  if ((await prisma.appointment.count()) > 0) {
    console.log('Appointments already exist: example appointments skipped.');
    return 0;
  }

  const [maria, joao] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'maria@email.com' } }),
    prisma.user.findUnique({ where: { email: 'joao@email.com' } }),
  ]);
  if (!maria || !joao) throw new Error('Seed clients not found.');

  const repositories = createRepositories(prisma);
  const now = new Date();
  const config = await repositories.schedule.getScheduleConfig();
  // Covers every day the planner may look at, in both directions.
  const today = toBusinessDate(now);
  const blockedDates = await repositories.blockedDates.findInRange(
    addDaysToDate(today, -SAMPLE_SEARCH_DAYS),
    addDaysToDate(today, SAMPLE_SEARCH_DAYS),
  );

  const appointments = buildSampleAppointments({
    now,
    config,
    blockedDates: new Set(blockedDates),
    mariaId: maria.id,
    joaoId: joao.id,
  });
  if (!appointments) {
    console.log('Not enough open days in the schedule: example appointments skipped.');
    return 0;
  }
  const { count } = await prisma.appointment.createMany({ data: appointments });
  return count;
}

async function main() {
  const env = loadEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);

  try {
    // skipDuplicates = INSERT ... ON CONFLICT DO NOTHING: existing rows are left untouched.
    const createdUsers = await prisma.user.createMany({
      data: await Promise.all(
        users.map(async ({ password, ...user }) => ({
          ...user,
          passwordHash: await hashPassword(password),
        })),
      ),
      skipDuplicates: true,
    });

    const createdSettings = await prisma.scheduleSettings.createMany({
      data: [{ id: 1, slotDurationMinutes: DEFAULT_SLOT_DURATION_MINUTES }],
      skipDuplicates: true,
    });

    const createdHours = await prisma.workingHour.createMany({
      data: workingHours,
      skipDuplicates: true,
    });

    const createdAppointments = await seedSampleAppointments(prisma);

    console.log(
      `Seed finished: ${createdUsers.count} user(s), ${createdSettings.count} schedule setting(s), ` +
        `${createdHours.count} working hour row(s), ${createdAppointments} appointment(s) created.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
