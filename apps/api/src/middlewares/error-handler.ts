import type { ApiErrorBody } from '@agenda/shared';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { AppError, PayloadTooLargeError, ValidationError } from '../lib/errors.js';
import { fromPrismaError } from '../lib/prisma-errors.js';
import { toFieldErrors } from './validate.js';

/**
 * Client errors raised by Express internals carry an HTTP `status`: body-parser (express.json())
 * also sets a `type`; the router throws a URIError with status 400 for a malformed URL parameter.
 */
type HttpClientError = Error & { status: number; type?: unknown };

function isHttpClientError(err: unknown): err is HttpClientError {
  if (!(err instanceof Error)) return false;
  const status = (err as Partial<HttpClientError>).status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof z.ZodError) return new ValidationError('Dados inválidos.', toFieldErrors(err));
  const fromDatabase = fromPrismaError(err);
  if (fromDatabase) return fromDatabase;
  if (isHttpClientError(err)) {
    if (err.type === 'entity.too.large') return new PayloadTooLargeError();
    if (err.type === 'entity.parse.failed') {
      return new ValidationError('O corpo da requisição não é um JSON válido.');
    }
    if (typeof err.type === 'string') {
      return new ValidationError('Não foi possível ler o corpo da requisição.');
    }
    if (err instanceof URIError) {
      return new ValidationError('A URL da requisição contém caracteres inválidos.');
    }
    return new ValidationError('Requisição inválida.');
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
