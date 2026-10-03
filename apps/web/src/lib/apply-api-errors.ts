import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, getFieldErrors } from './api-client';

/**
 * Shows an API error inside the form when it belongs there: field errors from `details`,
 * 409 EMAIL_ALREADY_IN_USE on the e-mail field, 401 INVALID_CREDENTIALS as a form-level error.
 * Returns false when the error is not about the form (the caller shows a toast instead).
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly NoInfer<Path<T>>[],
): boolean {
  if (!(error instanceof ApiError)) return false;

  if (error.code === 'VALIDATION_ERROR') {
    let applied = false;
    for (const [field, messages] of Object.entries(getFieldErrors(error))) {
      const known = fields.find((name) => name === field);
      if (known && messages[0]) {
        setError(known, { type: 'server', message: messages[0] });
        applied = true;
      }
    }
    return applied;
  }

  if (error.code === 'EMAIL_ALREADY_IN_USE') {
    const email = fields.find((name) => name === 'email');
    if (!email) return false;
    setError(email, { type: 'server', message: error.message });
    return true;
  }

  if (error.code === 'INVALID_CREDENTIALS') {
    setError('root.server', { type: 'server', message: error.message });
    return true;
  }

  return false;
}
