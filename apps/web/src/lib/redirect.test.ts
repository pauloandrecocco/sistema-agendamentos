import { describe, expect, it } from 'vitest';
import { getHomePathForRole, getSafeRedirect, withRedirect } from './redirect';

describe('getSafeRedirect', () => {
  it('accepts internal paths, including query strings', () => {
    expect(getSafeRedirect('/meus-agendamentos')).toBe('/meus-agendamentos');
    expect(getSafeRedirect('/agendar?date=2026-10-05&slot=2026-10-05T12:00:00.000Z')).toBe(
      '/agendar?date=2026-10-05&slot=2026-10-05T12:00:00.000Z',
    );
  });

  it.each([
    ['protocol-relative', '//site.com'],
    ['protocol-relative with path', '//site.com/agendar'],
    ['backslash variant', '/\\site.com'],
    ['tab dropped by the URL parser', '/\t/site.com'],
    ['newline dropped by the URL parser', '/\n/site.com'],
    ['carriage return dropped by the URL parser', '/\r/site.com'],
    ['tab before a backslash', '/\t\\site.com'],
    ['newline inside an internal path', '/agendar\n'],
    ['absolute URL', 'https://site.com'],
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'agendar'],
    ['empty', ''],
  ])('refuses %s', (_label, value) => {
    expect(getSafeRedirect(value)).toBeNull();
  });

  it('refuses a missing value', () => {
    expect(getSafeRedirect(null)).toBeNull();
    expect(getSafeRedirect(undefined)).toBeNull();
  });
});

describe('getHomePathForRole', () => {
  it('sends ADMIN to /admin and CLIENT to /agendar', () => {
    expect(getHomePathForRole('ADMIN')).toBe('/admin');
    expect(getHomePathForRole('CLIENT')).toBe('/agendar');
  });
});

describe('withRedirect', () => {
  it('encodes a safe redirect', () => {
    expect(withRedirect('/login', '/agendar?date=2026-10-05&slot=x')).toBe(
      '/login?redirect=%2Fagendar%3Fdate%3D2026-10-05%26slot%3Dx',
    );
  });

  it('drops an unsafe or missing redirect', () => {
    expect(withRedirect('/cadastro', '//site.com')).toBe('/cadastro');
    expect(withRedirect('/cadastro', null)).toBe('/cadastro');
  });
});
