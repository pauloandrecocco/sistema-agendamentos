import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_SECRET: 'secret' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadEnv', () => {
  it('defaults JWT_EXPIRES_IN to 8h', () => {
    expect(loadEnv(base).JWT_EXPIRES_IN).toBe('8h');
  });

  it.each(['8h', '30m', '3600s', '7d'])('accepts JWT_EXPIRES_IN=%s', (value) => {
    expect(loadEnv({ ...base, JWT_EXPIRES_IN: value }).JWT_EXPIRES_IN).toBe(value);
  });

  // A bare number would be read by jsonwebtoken as milliseconds ("3600" → 3.6 seconds).
  it.each(['3600', '8 h', 'h', '0h', '1.5h'])('rejects JWT_EXPIRES_IN=%s', (value) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    expect(() => loadEnv({ ...base, JWT_EXPIRES_IN: value })).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
