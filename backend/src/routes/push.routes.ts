import { Router } from 'express';

import {
  deleteSubscribe,
  getPushKey,
  postSubscribe,
  postTest,
} from '../controllers/push.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';

const router = Router();

// Unauthenticated: it is a public key, and the sign-in screen may want to know
// whether push exists before anybody has a session.
router.get('/key', getPushKey);

router.post('/subscribe', requireAuth, postSubscribe);
router.delete('/subscribe', requireAuth, deleteSubscribe);

// Admin only, and it can only ever notify the caller's own devices — so it
// works in production, which is the only place the answer is interesting.
router.post('/test', requireAuth, requireAdmin, postTest);

export default router;
