import { Role } from '@agenda/shared';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addUser, buildTestApp, getSessionCookie } from './helpers/build-test-app.js';

const validRegistration = {
  name: 'Ana Lima',
  email: 'ana@email.com',
  password: 'senha1234',
};

let ctx: ReturnType<typeof buildTestApp>;

beforeEach(() => {
  ctx = buildTestApp();
});

describe('POST /api/auth/register', () => {
  it('creates a CLIENT, ignoring any role sent, and starts a session', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...validRegistration, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        name: 'Ana Lima',
        email: 'ana@email.com',
        phone: null,
        role: Role.CLIENT,
      },
    });
    expect(ctx.users.users[0]?.role).toBe(Role.CLIENT);
    expect(getSessionCookie(res.headers['set-cookie'])).toMatch(/^access_token=.+/);
  });

  it('never returns or stores the plain password', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send(validRegistration);

    expect(JSON.stringify(res.body)).not.toContain('senha1234');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(ctx.users.users[0]?.passwordHash).not.toBe('senha1234');
  });

  it('normalizes the email (trim + lowercase)', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: '  Ana@Email.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ana@email.com');
  });

  it('rejects a duplicated email (case-insensitive) with 409 EMAIL_ALREADY_IN_USE', async () => {
    await request(ctx.app).post('/api/auth/register').send(validRegistration);
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'ANA@email.com' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_ALREADY_IN_USE', message: 'Este e-mail já está cadastrado.' },
    });
  });

  it('turns the unique index violation of a concurrent registration into 409', async () => {
    await request(ctx.app).post('/api/auth/register').send(validRegistration);
    // The other request passed the application check before this one was stored.
    vi.spyOn(ctx.users, 'findByEmail').mockResolvedValueOnce(null);

    const res = await request(ctx.app).post('/api/auth/register').send(validRegistration);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_ALREADY_IN_USE', message: 'Este e-mail já está cadastrado.' },
    });
  });

  it('accepts a masked phone and stores only the digits', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...validRegistration, phone: '(11) 98765-4321' });

    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBe('11987654321');
  });

  it('accepts an empty phone as "not informed"', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ ...validRegistration, phone: '' });

    expect(res.status).toBe(201);
    expect(res.body.user.phone).toBeNull();
  });

  it.each(['12345', 'abc', '( ) -'])(
    'rejects the informed phone %s with 400 and field details',
    async (phone) => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ ...validRegistration, phone });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual({ phone: [expect.any(String)] });
      expect(ctx.users.users).toHaveLength(0);
    },
  );

  it('reports every invalid field', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'nope', password: '123' });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await addUser(ctx.users, { email: 'maria@email.com', password: 'cliente123' });
  });

  it('starts a session with an httpOnly, SameSite=Lax cookie', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'MARIA@email.com', password: 'cliente123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('maria@email.com');

    const setCookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(setCookie).toMatch(/^access_token=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=28800'); // 8h, same as the token lifetime
    expect(setCookie).not.toContain('Secure');
  });

  it('puts the user id and role in the token', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'maria@email.com', password: 'cliente123' });

    const token = getSessionCookie(res.headers['set-cookie']).replace('access_token=', '');
    expect(jwt.decode(token)).toMatchObject({ sub: res.body.user.id, role: Role.CLIENT });
  });

  it('answers wrong password and unknown email with the same generic 401', async () => {
    const wrongPassword = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'maria@email.com', password: 'errada123' });
    const unknownEmail = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@email.com', password: 'cliente123' });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('answers a password longer than 72 characters with the same generic 401', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'maria@email.com', password: 'a'.repeat(100) });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
    });
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 UNAUTHENTICATED without a cookie', async () => {
    const res = await request(ctx.app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 with an invalid or tampered token', async () => {
    const forged = jwt.sign({ role: Role.ADMIN }, 'other-secret', { subject: 'x' });
    for (const cookie of ['access_token=garbage', `access_token=${forged}`]) {
      const res = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('returns 401 with an expired token', async () => {
    const user = await addUser(ctx.users, { email: 'maria@email.com', password: 'cliente123' });
    const expired = jwt.sign(
      { role: Role.CLIENT, exp: Math.floor(Date.now() / 1000) - 60 },
      'test-secret',
      { subject: user.id },
    );
    const res = await request(ctx.app).get('/api/auth/me').set('Cookie', `access_token=${expired}`);

    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid session', async () => {
    const register = await request(ctx.app).post('/api/auth/register').send(validRegistration);
    const res = await request(ctx.app)
      .get('/api/auth/me')
      .set('Cookie', getSessionCookie(register.headers['set-cookie']));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: register.body.user });
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie with 204, even without a session', async () => {
    const res = await request(ctx.app).post('/api/auth/logout');

    expect(res.status).toBe(204);
    const setCookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(setCookie).toMatch(/^access_token=;/);
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });
});
