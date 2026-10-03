import type { Role } from '@agenda/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ConflictError } from '../../lib/errors.js';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: Role;
};

export type CreateUserData = Omit<UserRecord, 'id'>;

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Throws ConflictError(EMAIL_ALREADY_IN_USE) when the email already exists. */
  create(data: CreateUserData): Promise<UserRecord>;
}

export const EMAIL_IN_USE_MESSAGE = 'Este e-mail já está cadastrado.';

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  passwordHash: true,
  role: true,
} as const;

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userSelect });
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userSelect });
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data, select: userSelect });
    } catch (error) {
      // Concurrent registration with the same email: the unique index decides.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('EMAIL_ALREADY_IN_USE', EMAIL_IN_USE_MESSAGE);
      }
      throw error;
    }
  }
}
