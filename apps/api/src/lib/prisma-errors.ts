import { Prisma } from '../generated/prisma/client.js';
import { ConflictError, SLOT_ALREADY_BOOKED_MESSAGE, type AppError } from './errors.js';

const OVERLAP_CONSTRAINT = 'appointments_no_overlap';
const EXCLUSION_VIOLATION = '23P01';

/**
 * Postgres error forwarded by @prisma/adapter-pg. Verified against the real database (Prisma 7.10):
 * an exclusion violation arrives as PrismaClientKnownRequestError with the generic code P2039 and
 * `meta.driverAdapterError.cause = { kind: 'postgres', originalCode: '23P01', originalMessage }`,
 * both inside and outside interactive transactions. The constraint name is only in the message.
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

/** Single place where database errors become API errors (used by the errorHandler). */
export function fromPrismaError(error: unknown): AppError | null {
  if (isAppointmentOverlapViolation(error)) {
    return new ConflictError('SLOT_ALREADY_BOOKED', SLOT_ALREADY_BOOKED_MESSAGE);
  }
  return null;
}
