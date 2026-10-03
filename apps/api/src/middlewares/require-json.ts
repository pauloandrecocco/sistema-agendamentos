import type { RequestHandler } from 'express';
import { UnsupportedMediaTypeError } from '../lib/errors.js';

const METHODS_WITH_BODY = new Set(['POST', 'PUT']);

function hasBody(headers: { 'transfer-encoding'?: string; 'content-length'?: string }): boolean {
  return headers['transfer-encoding'] !== undefined || Number(headers['content-length']) > 0;
}

/** POST/PUT requests that carry a body must be JSON (PRD section 13). Bodyless requests pass. */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (METHODS_WITH_BODY.has(req.method) && hasBody(req.headers) && !req.is('application/json')) {
    throw new UnsupportedMediaTypeError();
  }
  next();
};
