import type { Role } from './enums.js';

export type HealthResponse = { status: 'ok' };

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

export type UserResponse = { user: PublicUser };

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'SLOT_ALREADY_BOOKED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SLOT_IN_PAST'
  | 'SLOT_NOT_AVAILABLE'
  | 'APPOINTMENT_ALREADY_CANCELLED'
  | 'APPOINTMENT_ALREADY_STARTED'
  | 'INVALID_DATE'
  | 'INTERNAL_ERROR';

/** Field errors: field path (e.g. "email") -> messages. */
export type FieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};
