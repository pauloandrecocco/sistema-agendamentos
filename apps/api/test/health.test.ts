import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app.js';

describe('GET /api/health', () => {
  it('responds with status ok', async () => {
    const res = await request(buildTestApp().app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
