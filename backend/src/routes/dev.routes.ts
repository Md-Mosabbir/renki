import { Router } from 'express';

import {
  getDevUsers,
  postDevLogin,
  postDevVerify,
} from '../controllers/dev.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Development-only routes. See `controllers/dev.controller.ts` for why this
 * exists and how it is contained — in short, it is an authentication bypass
 * that `routes/index.ts` refuses to mount outside development.
 */
const router = Router();

// GET  /api/dev/users            list the seeded accounts
// POST /api/dev/login            body: { email } -> { token, user }
// POST /api/dev/verify         requireAuth -> { user }   marks the CALLER verified
router.get('/users', getDevUsers);
router.post('/login', postDevLogin);

// requireAuth on this one and not the others: /login has no caller yet, while
// this verifies whoever is holding the token and must never take an id from a
// body. See postDevVerify.
router.post('/verify', requireAuth, postDevVerify);

export default router;
