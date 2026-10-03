import type { RequestHandler } from 'express';
import { UnauthenticatedError } from '../lib/errors.js';
import type { TokenService } from '../lib/jwt.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';

/** Reads the session cookie and sets `req.auth`; responds 401 when it is missing or invalid. */
export function createAuthenticate(tokenService: TokenService): RequestHandler {
  return (req, _res, next) => {
    // cookie-parser types req.cookies as `any`.
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[ACCESS_TOKEN_COOKIE];
    if (typeof token !== 'string' || token === '') throw new UnauthenticatedError();
    req.auth = tokenService.verify(token);
    next();
  };
}
