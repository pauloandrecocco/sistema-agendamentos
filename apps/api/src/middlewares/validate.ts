import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

/** Field errors keyed by field path; issues without a path go under "_". */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Parses body/query/params with Zod and replaces them with the parsed (normalized) values. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const fields: Record<string, string[]> = {};
    const parsed: Partial<Record<keyof Schemas, unknown>> = {};

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) parsed[key] = result.data;
      else Object.assign(fields, toFieldErrors(result.error));
    }

    if (Object.keys(fields).length > 0) throw new ValidationError('Dados inválidos.', fields);

    if ('body' in parsed) req.body = parsed.body;
    if ('params' in parsed) req.params = parsed.params as typeof req.params;
    // Express 5 exposes req.query as a getter, so it has to be redefined instead of assigned.
    if ('query' in parsed) {
      Object.defineProperty(req, 'query', { value: parsed.query, writable: true });
    }
    next();
  };
}
