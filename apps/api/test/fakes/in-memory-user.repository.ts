import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../src/lib/errors.js';
import {
  EMAIL_IN_USE_MESSAGE,
  type CreateUserData,
  type UserRecord,
  type UserRepository,
} from '../../src/modules/auth/auth.repository.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users: UserRecord[] = [];

  findByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  /** Mirrors the unique index on users.email. */
  create(data: CreateUserData): Promise<UserRecord> {
    if (this.users.some((user) => user.email === data.email)) {
      return Promise.reject(new ConflictError('EMAIL_ALREADY_IN_USE', EMAIL_IN_USE_MESSAGE));
    }
    const user = { id: randomUUID(), ...data };
    this.users.push(user);
    return Promise.resolve(user);
  }
}
