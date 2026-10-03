import type { Role } from '@agenda/shared';
import type { PrismaClient } from '../../generated/prisma/client.js';

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
  /**
   * A duplicated email (concurrent registration) is rejected by the unique index; the database
   * error becomes 409 EMAIL_ALREADY_IN_USE in lib/prisma-errors.ts.
   */
  create(data: CreateUserData): Promise<UserRecord>;
}

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

  create(data: CreateUserData): Promise<UserRecord> {
    return this.prisma.user.create({ data, select: userSelect });
  }
}
