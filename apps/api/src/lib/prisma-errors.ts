import { Prisma } from '../generated/prisma/client.js';
import {
  ConflictError,
  EMAIL_IN_USE_MESSAGE,
  SLOT_ALREADY_BOOKED_MESSAGE,
  type AppError,
} from './errors.js';

const OVERLAP_CONSTRAINT = 'appointments_no_overlap';
const EXCLUSION_VIOLATION = '23P01';
const EMAIL_UNIQUE_INDEX = 'users_email_key';
const UNIQUE_VIOLATION = '23505';

/**
 * Postgres error forwarded by @prisma/adapter-pg. Verified against the real database (Prisma 7.10),
 * both inside and outside interactive transactions:
 * - exclusion violation: PrismaClientKnownRequestError with the generic code P2039 and
 *   `meta.driverAdapterError.cause = { kind: 'postgres', originalCode: '23P01', originalMessage }`;
 *   the constraint name is only in the message.
 * - unique violation: code P2002 and `cause = { kind: 'UniqueConstraintViolation',
 *   originalCode: '23505', originalMessage, constraint: { index }, table }`.
 */
type DriverErrorCause = { kind?: unknown; originalCode?: unknown; originalMessage?: unknown };

function getDriverErrorCause(error: Prisma.PrismaClientKnownRequestError): DriverErrorCause | null {
  const driverError = (error.meta as { driverAdapterError?: { cause?: unknown } } | undefined)
    ?.driverAdapterError;
  const cause = driverError?.cause;
  return typeof cause === 'object' && cause !== null ? cause : null;
}

/** True when the error is the appointments_no_overlap exclusion constraint (SQLSTATE 23P01). */
export function isAppointmentOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const cause = getDriverErrorCause(error);
  return (
    cause?.kind === 'postgres' &&
    cause.originalCode === EXCLUSION_VIOLATION &&
    typeof cause.originalMessage === 'string' &&
    cause.originalMessage.includes(OVERLAP_CONSTRAINT)
  );
}

/** True when the error is the unique index on users.email (SQLSTATE 23505). */
export function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const cause = getDriverErrorCause(error);
  return (
    cause?.originalCode === UNIQUE_VIOLATION &&
    typeof cause.originalMessage === 'string' &&
    cause.originalMessage.includes(EMAIL_UNIQUE_INDEX)
  );
}

/** Single place where database errors become API errors (used by the errorHandler). */
export function fromPrismaError(error: unknown): AppError | null {
  if (isAppointmentOverlapViolation(error)) {
    return new ConflictError('SLOT_ALREADY_BOOKED', SLOT_ALREADY_BOOKED_MESSAGE);
  }
  if (isEmailUniqueViolation(error)) {
    return new ConflictError('EMAIL_ALREADY_IN_USE', EMAIL_IN_USE_MESSAGE);
  }
  return null;
}
