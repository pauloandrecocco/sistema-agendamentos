import { randomUUID } from 'node:crypto';
import type {
  CreateUserData,
  UserRecord,
  UserRepository,
} from '../../src/modules/auth/auth.repository.js';
import { createEmailUniqueViolationError } from './prisma-error.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users: UserRecord[] = [];

  findByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  /** Mirrors the unique index on users.email, failing with the same error Prisma raises. */
  create(data: CreateUserData): Promise<UserRecord> {
    if (this.users.some((user) => user.email === data.email)) {
      return Promise.reject(createEmailUniqueViolationError());
    }
    const user = { id: randomUUID(), ...data };
    this.users.push(user);
    return Promise.resolve(user);
  }
}
