import { Role, type LoginData, type PublicUser, type RegisterData } from '@agenda/shared';
import { ConflictError, UnauthenticatedError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { EMAIL_IN_USE_MESSAGE, type UserRecord, type UserRepository } from './auth.repository.js';

const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.';

/** Compared against when the email does not exist, so both failures take about the same time. */
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword('dummy-password-for-timing'));
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  /** Always creates a CLIENT (PRD section 3); any role sent by the client is ignored. */
  async register(data: RegisterData): Promise<PublicUser> {
    if (await this.users.findByEmail(data.email)) {
      throw new ConflictError('EMAIL_ALREADY_IN_USE', EMAIL_IN_USE_MESSAGE);
    }
    const user = await this.users.create({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      passwordHash: await hashPassword(data.password),
      role: Role.CLIENT,
    });
    return toPublicUser(user);
  }

  /** Generic 401 that does not reveal whether the email exists (RN-14). */
  async login(data: LoginData): Promise<PublicUser> {
    const user = await this.users.findByEmail(data.email);
    const passwordMatches = await verifyPassword(
      data.password,
      user?.passwordHash ?? (await getDummyHash()),
    );
    if (!user || !passwordMatches) {
      throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE, 'INVALID_CREDENTIALS');
    }
    return toPublicUser(user);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthenticatedError();
    return toPublicUser(user);
  }
}
