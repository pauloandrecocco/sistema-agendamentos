import type { Role } from '@agenda/shared';
import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthenticatedError } from '../lib/errors.js';

/** Must run after `authenticate`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    if (!roles.includes(req.auth.role)) throw new ForbiddenError();
    next();
  };
}
