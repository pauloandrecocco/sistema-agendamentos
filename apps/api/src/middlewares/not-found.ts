import type { RequestHandler } from 'express';
import { NotFoundError } from '../lib/errors.js';

/** Catch-all registered after every route: unknown paths get the standard error format. */
export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError('Rota não encontrada.');
};
