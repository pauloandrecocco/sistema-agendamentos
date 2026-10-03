/**
 * Idempotent seed (PRD section 14.4): runs on every API start in Docker.
 * Only inserts what is missing; never overwrites existing users or schedule changes made by the admin.
 * Example appointments are added in phase 4.
 */
import { Role } from '@agenda/shared';
import { loadEnv } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';
import { createPrismaClient } from '../src/lib/prisma.js';

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

    console.log(
      `Seed finished: ${createdUsers.count} user(s), ${createdSettings.count} schedule setting(s), ` +
        `${createdHours.count} working hour row(s) created.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed', error);
  process.exit(1);
});
