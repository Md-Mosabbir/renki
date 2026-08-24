import { Router } from 'express';

import { getDevUsers, postDevLogin } from '../controllers/dev.controller.js';

/**
 * Development-only routes. See `controllers/dev.controller.ts` for why this
 * exists and how it is contained — in short, it is an authentication bypass
 * that `routes/index.ts` refuses to mount outside development.
 */
const router = Router();

// GET  /api/dev/users            list the seeded accounts
// POST /api/dev/login            body: { email } -> { token, user }
router.get('/users', getDevUsers);
router.post('/login', postDevLogin);

export default router;
