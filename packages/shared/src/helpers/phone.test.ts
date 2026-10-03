import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('keeps only digits', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
    expect(normalizePhone('+55 11 3333-4444')).toBe('551133334444');
  });

  it('returns an empty string when there are no digits', () => {
    expect(normalizePhone(' - ')).toBe('');
  });
});
