import { Role } from '@agenda/shared';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTokenService } from '../src/lib/jwt.js';
import { createAuthenticate } from '../src/middlewares/authenticate.js';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { requireRole } from '../src/middlewares/require-role.js';
import { validate } from '../src/middlewares/validate.js';

const tokenService = createTokenService({ secret: 'test-secret', expiresIn: '8h' });

function cookieFor(role: Role) {
  return `access_token=${tokenService.sign({ userId: 'user-1', role }).token}`;
}

describe('requireRole', () => {
  const app = express();
  app.use(cookieParser());
  app.get('/admin-only', createAuthenticate(tokenService), requireRole(Role.ADMIN), (req, res) => {
    res.json({ auth: req.auth });
  });
  app.use(errorHandler);

  it('visitor → 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/admin-only');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('CLIENT on an ADMIN route → 403 FORBIDDEN', async () => {
    const res = await request(app).get('/admin-only').set('Cookie', cookieFor(Role.CLIENT));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('ADMIN → passes with req.auth set', async () => {
    const res = await request(app).get('/admin-only').set('Cookie', cookieFor(Role.ADMIN));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ auth: { userId: 'user-1', role: Role.ADMIN } });
  });
});

describe('validate', () => {
  const app = express();
  app.get(
    '/items/:id',
    validate({
      params: z.object({ id: z.coerce.number().int() }),
      query: z.object({ page: z.coerce.number().int().default(1) }),
    }),
    (req, res) => {
      res.json({ params: req.params, query: req.query });
    },
  );
  app.use(errorHandler);

  it('replaces params and query with the parsed values', async () => {
    const res = await request(app).get('/items/7?page=3');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 7 }, query: { page: 3 } });
  });

  it('applies defaults', async () => {
    const res = await request(app).get('/items/7');

    expect(res.body.query).toEqual({ page: 1 });
  });

  it('invalid params/query → 400 with details per field', async () => {
    const res = await request(app).get('/items/abc?page=x');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details).sort()).toEqual(['id', 'page']);
  });
});
