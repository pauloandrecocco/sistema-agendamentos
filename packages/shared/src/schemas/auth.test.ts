import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

const valid = { name: 'Ana Lima', email: 'ana@email.com', password: 'senha1234' };

describe('registerSchema', () => {
  it('trims the name and normalizes the email to lowercase', () => {
    const data = registerSchema.parse({ ...valid, name: '  Ana Lima ', email: ' ANA@Email.COM ' });
    expect(data.name).toBe('Ana Lima');
    expect(data.email).toBe('ana@email.com');
  });

  it('strips unknown fields such as role', () => {
    const data = registerSchema.parse({ ...valid, role: 'ADMIN' });
    expect(data).not.toHaveProperty('role');
  });

  it('accepts a masked phone and stores only digits', () => {
    expect(registerSchema.parse({ ...valid, phone: '(11) 98765-4321' }).phone).toBe('11987654321');
    expect(registerSchema.parse({ ...valid, phone: '1133334444' }).phone).toBe('1133334444');
  });

  it('treats a missing, empty or blank phone as undefined', () => {
    expect(registerSchema.parse(valid).phone).toBeUndefined();
    expect(registerSchema.parse({ ...valid, phone: '' }).phone).toBeUndefined();
    expect(registerSchema.parse({ ...valid, phone: '   ' }).phone).toBeUndefined();
  });

  it.each(['123456789', '119876543210', '(11) 9876', 'abc', '( ) -'])('rejects phone %s', (phone) => {
    expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  it.each([
    ['name too short', { name: ' A ' }],
    ['name too long', { name: 'a'.repeat(101) }],
    ['invalid email', { email: 'ana@' }],
    ['password too short', { password: '1234567' }],
    ['password too long', { password: 'a'.repeat(73) }],
  ])('rejects %s', (_label, override) => {
    expect(registerSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('accepts password boundaries 8 and 72', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(8) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('normalizes the email', () => {
    expect(loginSchema.parse({ email: ' MARIA@email.com', password: 'x' }).email).toBe(
      'maria@email.com',
    );
  });

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'maria@email.com', password: '' }).success).toBe(false);
  });

  it('has no maximum password length (a long one is just wrong credentials)', () => {
    const password = 'a'.repeat(100);
    expect(loginSchema.safeParse({ email: 'maria@email.com', password }).success).toBe(true);
  });
});

describe('Zod locale', () => {
  it('built-in messages are in Portuguese', () => {
    const result = loginSchema.safeParse(undefined);
    expect(result.error?.issues[0]?.message).toMatch(/^Entrada inválida/);
  });
});
