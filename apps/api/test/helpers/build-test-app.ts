import { Role } from '@agenda/shared';
import { createApp } from '../../src/app.js';
import { createTokenService } from '../../src/lib/jwt.js';
import { hashPassword } from '../../src/lib/password.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { InMemoryUserRepository } from '../fakes/in-memory-user.repository.js';

export const TEST_JWT_SECRET = 'test-secret';

export function buildTestApp() {
  const users = new InMemoryUserRepository();
  const tokenService = createTokenService({ secret: TEST_JWT_SECRET, expiresIn: '8h' });
  const app = createApp({
    authService: new AuthService(users),
    tokenService,
    cookieSecure: false,
  });
  return { app, users, tokenService };
}

/** Inserts a user straight into the fake repository (e.g. the seeded admin). */
export async function addUser(
  users: InMemoryUserRepository,
  data: { email: string; password: string; role?: Role; name?: string; phone?: string | null },
) {
  return users.create({
    name: data.name ?? 'Usuário Teste',
    email: data.email,
    phone: data.phone ?? null,
    passwordHash: await hashPassword(data.password),
    role: data.role ?? Role.CLIENT,
  });
}

/** Extracts the access_token cookie (name=value) from a Set-Cookie header, ready for `.set('Cookie', …)`. */
export function getSessionCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith('access_token='));
  if (!cookie) throw new Error('access_token cookie not set');
  return cookie.split(';')[0]!;
}
