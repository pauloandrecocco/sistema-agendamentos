import { loginSchema, registerSchema } from '@agenda/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../middlewares/validate.js';
import type { AuthController } from './auth.controller.js';

export function createAuthRouter(controller: AuthController, authenticate: RequestHandler) {
  const router = Router();
  router.post('/register', validate({ body: registerSchema }), controller.register);
  router.post('/login', validate({ body: loginSchema }), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  return router;
}
