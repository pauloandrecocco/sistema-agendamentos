import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../src/middlewares/error-handler.js';
import { buildTestApp } from './helpers/build-test-app.js';

const { app } = buildTestApp();

/** Every error body must be exactly { error: { code, message, details? } } (PRD 10.2). */
function expectStandardError(body: unknown, code: string) {
  expect(body).toEqual({
    error: expect.objectContaining({ code, message: expect.any(String) }),
  });
  const keys = Object.keys((body as { error: object }).error);
  expect(keys.every((key) => ['code', 'message', 'details'].includes(key))).toBe(true);
}

describe('unknown routes', () => {
  it.each(['/api/nao-existe', '/api/auth/nope', '/qualquer'])(
    'GET %s → 404 NOT_FOUND in JSON',
    async (path) => {
      const res = await request(app).get(path);

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expectStandardError(res.body, 'NOT_FOUND');
    },
  );

  it('wrong method on an existing path → 404 NOT_FOUND', async () => {
    const res = await request(app).delete('/api/auth/login');

    expect(res.status).toBe(404);
    expectStandardError(res.body, 'NOT_FOUND');
  });
});

describe('request body', () => {
  it('malformed JSON → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expectStandardError(res.body, 'VALIDATION_ERROR');
  });

  it('body above 100kb → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@a.com', password: 'x'.repeat(110 * 1024) });

    expect(res.status).toBe(413);
    expectStandardError(res.body, 'PAYLOAD_TOO_LARGE');
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded'])(
    'POST with a %s body → 415 UNSUPPORTED_MEDIA_TYPE',
    async (contentType) => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', contentType)
        .send('email=maria@email.com&password=cliente123');

      expect(res.status).toBe(415);
      expectStandardError(res.body, 'UNSUPPORTED_MEDIA_TYPE');
    },
  );

  it('accepts application/json with a charset', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify({ email: 'ninguem@email.com', password: 'x' }));

    expect(res.status).toBe(401); // reached the service, not blocked by the content-type check
  });

  it('bodyless POST is not affected by the JSON-only rule', async () => {
    const res = await request(app).post('/api/auth/logout').set('Content-Type', 'text/plain');

    expect(res.status).toBe(204);
  });

  it('POST without a body to a route that requires one → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login');

    expect(res.status).toBe(400);
    expectStandardError(res.body, 'VALIDATION_ERROR');
  });
});

describe('errorHandler', () => {
  function appThrowing(error: unknown) {
    const testApp = express();
    testApp.get('/boom', () => {
      throw error;
    });
    testApp.use(errorHandler);
    return testApp;
  }

  it('unexpected error → 500 INTERNAL_ERROR without internal details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(appThrowing(new Error('db password is hunter2'))).get('/boom');

    expect(res.status).toBe(500);
    expectStandardError(res.body, 'INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('ZodError → 400 VALIDATION_ERROR with field details', async () => {
    const result = z.object({ email: z.email() }).safeParse({ email: 'x' });
    const res = await request(appThrowing(result.error)).get('/boom');

    expect(res.status).toBe(400);
    expectStandardError(res.body, 'VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ email: [expect.any(String)] });
  });
});
