import type { ApiErrorBody, ErrorCode, FieldErrors } from '@agenda/shared';

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR';

/** Every failed request becomes an ApiError; `message` is always displayable (pt-BR). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const UNEXPECTED_MESSAGE = 'Erro inesperado. Tente novamente mais tarde.';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  // Responses that do not come from the API (e.g. a proxy 502 page) are not JSON.
  const body: unknown = await response.json().catch(() => null);
  if (isApiErrorBody(body)) {
    return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', UNEXPECTED_MESSAGE);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin' };
  // The API rejects a body without JSON content type (415); body-less requests send no header.
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Single HTTP client of the app; paths are relative to `/api`. */
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
};

/** Field errors from a VALIDATION_ERROR `details` (`{ field: [messages] }`), or `{}`. */
export function getFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || typeof error.details !== 'object' || !error.details) {
    return {};
  }
  const fields: FieldErrors = {};
  for (const [field, messages] of Object.entries(error.details)) {
    if (Array.isArray(messages) && messages.every((message) => typeof message === 'string')) {
      fields[field] = messages;
    }
  }
  return fields;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_MESSAGE;
}

/** 401 UNAUTHENTICATED: the session cookie is missing or expired (not a login failure). */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'UNAUTHENTICATED';
}
