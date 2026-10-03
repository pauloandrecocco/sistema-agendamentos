import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, getFieldErrors, isUnauthenticated } from './api-client';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) throw new Error('Expected an ApiError');
  return error;
}

describe('api client', () => {
  it('returns the JSON body of a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'ok' }));

    await expect(api.get('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', {
      method: 'GET',
      credentials: 'same-origin',
    });
  });

  it('sends a JSON body with its content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user: {} }));

    await api.post('/auth/login', { email: 'a@b.com', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
    });
  });

  it('sends no content type without a body and resolves 204 to undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.post('/auth/logout')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  });

  it('turns an API error response into ApiError', async () => {
    const details = { email: ['E-mail inválido.'] };
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details },
      }),
    );

    const error = await catchError(api.post('/auth/register', {}));
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details,
    });
  });

  it('turns a non-API error response (e.g. proxy HTML page) into INTERNAL_ERROR', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const error = await catchError(api.get('/auth/me'));
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
    expect(error.message).toMatch(/inesperado/i);
  });

  it('turns a network failure into NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await catchError(api.get('/auth/me'));
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('getFieldErrors', () => {
  it('keeps only `field: string[]` entries of details', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', {
      email: ['E-mail inválido.'],
      weird: 42,
    });
    expect(getFieldErrors(error)).toEqual({ email: ['E-mail inválido.'] });
  });

  it('returns {} without details or for other errors', () => {
    expect(getFieldErrors(new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'x'))).toEqual({});
    expect(getFieldErrors(new Error('x'))).toEqual({});
  });
});

describe('isUnauthenticated', () => {
  it('is true only for UNAUTHENTICATED (not for a failed login)', () => {
    expect(isUnauthenticated(new ApiError(401, 'UNAUTHENTICATED', 'x'))).toBe(true);
    expect(isUnauthenticated(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(false);
  });
});
