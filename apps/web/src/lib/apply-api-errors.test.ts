import type { RegisterInput } from '@agenda/shared';
import type { UseFormSetError } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-client';
import { applyApiErrors } from './apply-api-errors';

const FIELDS = ['name', 'email', 'phone', 'password'] as const;

function setup() {
  const setError = vi.fn<UseFormSetError<RegisterInput>>();
  return { setError };
}

describe('applyApiErrors', () => {
  it('puts VALIDATION_ERROR details on the matching fields', () => {
    const { setError } = setup();
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', {
      phone: ['Telefone deve ter DDD + número (10 ou 11 dígitos).'],
      email: ['E-mail inválido.', 'outro'],
    });

    expect(applyApiErrors<RegisterInput>(error, setError, FIELDS)).toBe(true);
    expect(setError).toHaveBeenCalledWith('phone', {
      type: 'server',
      message: 'Telefone deve ter DDD + número (10 ou 11 dígitos).',
    });
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'E-mail inválido.' });
  });

  it('is not handled when no detail matches a form field', () => {
    const { setError } = setup();
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', { _: ['x'] });

    expect(applyApiErrors<RegisterInput>(error, setError, FIELDS)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('puts 409 EMAIL_ALREADY_IN_USE on the e-mail field', () => {
    const { setError } = setup();
    const error = new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'Este e-mail já está cadastrado.');

    expect(applyApiErrors<RegisterInput>(error, setError, FIELDS)).toBe(true);
    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Este e-mail já está cadastrado.',
    });
  });

  it('shows 401 INVALID_CREDENTIALS as a form-level error', () => {
    const { setError } = setup();
    const error = new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');

    expect(applyApiErrors<RegisterInput>(error, setError, FIELDS)).toBe(true);
    expect(setError).toHaveBeenCalledWith('root.server', {
      type: 'server',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('leaves other errors to the caller (toast)', () => {
    const { setError } = setup();

    expect(
      applyApiErrors<RegisterInput>(new ApiError(0, 'NETWORK_ERROR', 'x'), setError, FIELDS),
    ).toBe(false);
    expect(applyApiErrors<RegisterInput>(new Error('x'), setError, FIELDS)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
