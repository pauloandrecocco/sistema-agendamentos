import type { ErrorCode } from '@agenda/shared';

export class AppError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos.', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(
    message = 'Você precisa estar autenticado.',
    code: 'UNAUTHENTICATED' | 'INVALID_CREDENTIALS' = 'UNAUTHENTICATED',
  ) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para acessar este recurso.') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado.') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: 'EMAIL_ALREADY_IN_USE' | 'SLOT_ALREADY_BOOKED', message: string) {
    super(409, code, message);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'O corpo da requisição é grande demais.') {
    super(413, 'PAYLOAD_TOO_LARGE', message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Envie o corpo da requisição em JSON (Content-Type: application/json).') {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }
}

export class BusinessRuleError extends AppError {
  constructor(
    code:
      | 'SLOT_IN_PAST'
      | 'SLOT_NOT_AVAILABLE'
      | 'APPOINTMENT_ALREADY_CANCELLED'
      | 'APPOINTMENT_ALREADY_STARTED'
      | 'INVALID_DATE',
    message: string,
    details?: unknown,
  ) {
    super(422, code, message, details);
  }
}

/** Same message for the application check and the exclusion constraint (RN-07). */
export const SLOT_ALREADY_BOOKED_MESSAGE = 'Este horário já foi reservado.';

/** Same message for the application check and the unique index on users.email. */
export const EMAIL_IN_USE_MESSAGE = 'Este e-mail já está cadastrado.';
