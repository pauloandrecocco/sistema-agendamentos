import type { AuthContext } from '../lib/jwt.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. */
      auth?: AuthContext;
    }
  }
}

export {};
