import type { LoginData, PublicUser, RegisterData, UserResponse } from '@agenda/shared';
import type { CookieOptions, Request, Response } from 'express';
import { UnauthenticatedError } from '../../lib/errors.js';
import type { TokenService } from '../../lib/jwt.js';
import { ACCESS_TOKEN_COOKIE } from '../../middlewares/authenticate.js';
import type { AuthService } from './auth.service.js';

type Deps = { authService: AuthService; tokenService: TokenService; cookieSecure: boolean };

export function createAuthController({ authService, tokenService, cookieSecure }: Deps) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
  };

  function startSession(res: Response, user: PublicUser) {
    const { token, maxAgeMs } = tokenService.sign({ userId: user.id, role: user.role });
    res.cookie(ACCESS_TOKEN_COOKIE, token, { ...cookieOptions, maxAge: maxAgeMs });
  }

  return {
    register: async (req: Request, res: Response) => {
      const user = await authService.register(req.body as RegisterData);
      startSession(res, user);
      res.status(201).json({ user } satisfies UserResponse);
    },

    login: async (req: Request, res: Response) => {
      const user = await authService.login(req.body as LoginData);
      startSession(res, user);
      res.json({ user } satisfies UserResponse);
    },

    logout: (_req: Request, res: Response) => {
      res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions);
      res.status(204).end();
    },

    me: async (req: Request, res: Response) => {
      if (!req.auth) throw new UnauthenticatedError();
      const user = await authService.getMe(req.auth.userId);
      res.json({ user } satisfies UserResponse);
    },
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
