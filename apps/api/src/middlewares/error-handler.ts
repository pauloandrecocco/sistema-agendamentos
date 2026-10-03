import type { ApiErrorBody } from '@agenda/shared';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError, PayloadTooLargeError, ValidationError } from '../lib/errors.js';
import { toFieldErrors } from './validate.js';

/** Errors raised by express.json() (body-parser) carry a `type` and an HTTP `status`. */
type BodyParserError = Error & { type: string; status: number };

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    typeof (err as Partial<BodyParserError>).type === 'string' &&
    typeof (err as Partial<BodyParserError>).status === 'number'
  );
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof z.ZodError) return new ValidationError('Dados inválidos.', toFieldErrors(err));
  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    if (err.type === 'entity.too.large') return new PayloadTooLargeError();
    if (err.type === 'entity.parse.failed') {
      return new ValidationError('O corpo da requisição não é um JSON válido.');
    }
    return new ValidationError('Não foi possível ler o corpo da requisição.');
  }
  return null;
}

/** Single place that turns errors into `{ error: { code, message, details? } }` (PRD 10.2). */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  if (!appError) {
    console.error(`Unexpected error on ${req.method} ${req.originalUrl}`, err);
    const body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
    };
    res.status(500).json(body);
    return;
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
    },
  };
  res.status(appError.httpStatus).json(body);
};
