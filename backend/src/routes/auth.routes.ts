import { Router } from 'express';
import { googleSignin, getUserMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/google/
// body: { googleToken: string }
// response: { token: string, user: User }
router.post('/google', googleSignin);
// GET /api/auth/me
// header: Authorization: Bearer <token>
// response: { data: { user } }
// requireAuth comes first — argument order is execution order.
router.get('/me', requireAuth, getUserMe);

export default router;
