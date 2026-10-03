import { Prisma } from '../../src/generated/prisma/client.js';

const MESSAGE = 'conflicting key value violates exclusion constraint "appointments_no_overlap"';

/**
 * Same shape Prisma 7 + @prisma/adapter-pg produced against the real database for an
 * appointments_no_overlap violation (see lib/prisma-errors.ts).
 */
export function createOverlapViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `Database error. Code: \`23P01\`. Message: \`${MESSAGE}\``,
    {
      code: 'P2039',
      clientVersion: Prisma.prismaVersion.client,
      meta: {
        modelName: 'Appointment',
        driverAdapterError: {
          name: 'DriverAdapterError',
          message: MESSAGE,
          cause: {
            originalCode: '23P01',
            originalMessage: MESSAGE,
            kind: 'postgres',
            code: '23P01',
            severity: 'ERROR',
            message: MESSAGE,
          },
        },
      },
    },
  );
}

const EMAIL_UNIQUE_MESSAGE = 'duplicate key value violates unique constraint "users_email_key"';

/** Same shape Prisma 7 + @prisma/adapter-pg produced against the real database for users.email. */
export function createEmailUniqueViolationError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the constraint: `users_email_key`',
    {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            originalMessage: EMAIL_UNIQUE_MESSAGE,
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'users_email_key' },
            table: 'users',
          },
        },
      },
    },
  );
}
