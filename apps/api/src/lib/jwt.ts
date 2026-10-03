import { Role } from '@agenda/shared';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthenticatedError } from './errors.js';

export type AuthContext = { userId: string; role: Role };

export type TokenService = {
  /** Signs a session token; `maxAgeMs` matches the token lifetime (used for the cookie). */
  sign(auth: AuthContext): { token: string; maxAgeMs: number };
  /** Returns the session of a valid token; throws UnauthenticatedError otherwise. */
  verify(token: string): AuthContext;
};

const ALGORITHM = 'HS256';
const roles: readonly string[] = Object.values(Role);

export function createTokenService(options: { secret: string; expiresIn: string }): TokenService {
  return {
    sign({ userId, role }) {
      const token = jwt.sign({ role }, options.secret, {
        algorithm: ALGORITHM,
        subject: userId,
        // Format validated in config/env.ts.
        expiresIn: options.expiresIn as SignOptions['expiresIn'],
      });
      const { iat, exp } = jwt.decode(token) as { iat: number; exp: number };
      return { token, maxAgeMs: (exp - iat) * 1000 };
    },

    verify(token) {
      let payload: string | jwt.JwtPayload;
      try {
        payload = jwt.verify(token, options.secret, { algorithms: [ALGORITHM] });
      } catch {
        throw new UnauthenticatedError('Sessão inválida ou expirada. Faça login novamente.');
      }
      if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        typeof payload.role !== 'string' ||
        !roles.includes(payload.role)
      ) {
        throw new UnauthenticatedError('Sessão inválida ou expirada. Faça login novamente.');
      }
      return { userId: payload.sub, role: payload.role as Role };
    },
  };
}
