import { z } from 'zod';
import '../zod-locale.js';
import { normalizePhone } from '../helpers/phone.js';

const emailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido.' }));

// Only a blank string means "not informed"; anything else must have 10 or 11 digits (RN-14).
const phoneSchema = z
  .string()
  .trim()
  .transform((phone) => (phone === '' ? undefined : normalizePhone(phone)))
  .refine((digits) => digits === undefined || digits.length === 10 || digits.length === 11, {
    error: 'Telefone deve ter DDD + número (10 ou 11 dígitos).',
  });

export const registerSchema = z.object({
  name: z
    .string({ error: 'Informe o nome.' })
    .trim()
    .min(2, { error: 'O nome deve ter pelo menos 2 caracteres.' })
    .max(100, { error: 'O nome deve ter no máximo 100 caracteres.' }),
  email: emailSchema,
  phone: phoneSchema.optional(),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(8, { error: 'A senha deve ter pelo menos 8 caracteres.' })
    .max(72, { error: 'A senha deve ter no máximo 72 caracteres.' }),
});
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Informe a senha.' }).min(1, { error: 'Informe a senha.' }),
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;
