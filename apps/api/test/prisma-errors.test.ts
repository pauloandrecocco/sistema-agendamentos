import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { ConflictError } from '../src/lib/errors.js';
import { fromPrismaError, isAppointmentOverlapViolation } from '../src/lib/prisma-errors.js';
import { createOverlapViolationError } from './fakes/prisma-error.js';

function knownError(code: string, cause?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: cause ? { driverAdapterError: { cause } } : {},
  });
}

describe('prisma-errors', () => {
  it('recognizes the appointments_no_overlap violation (shape captured from the real database)', () => {
    const error = createOverlapViolationError();

    expect(isAppointmentOverlapViolation(error)).toBe(true);
    const converted = fromPrismaError(error);
    expect(converted).toBeInstanceOf(ConflictError);
    expect(converted).toMatchObject({ httpStatus: 409, code: 'SLOT_ALREADY_BOOKED' });
  });

  it('ignores other database errors', () => {
    const otherExclusion = knownError('P2039', {
      kind: 'postgres',
      originalCode: '23P01',
      originalMessage: 'conflicting key value violates exclusion constraint "other_constraint"',
    });
    const checkViolation = knownError('P2039', {
      kind: 'postgres',
      originalCode: '23514',
      originalMessage: 'new row violates check constraint "appointments_end_after_start"',
    });
    const uniqueViolation = knownError('P2002');

    for (const error of [otherExclusion, checkViolation, uniqueViolation]) {
      expect(fromPrismaError(error)).toBeNull();
    }
  });

  it('ignores non-Prisma errors', () => {
    expect(fromPrismaError(new Error('appointments_no_overlap 23P01'))).toBeNull();
    expect(fromPrismaError({ meta: { driverAdapterError: { cause: {} } } })).toBeNull();
    expect(fromPrismaError(undefined)).toBeNull();
  });
});
