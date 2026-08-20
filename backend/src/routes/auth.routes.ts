import { Router } from 'express';
import { googleSignin, getUserMe, addUserInfo } from '../controllers/auth.controller.js';
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

// POST /api/auth/gather-info   — the onboarding form
// header: Authorization: Bearer <token>
// body: { name, university, gender: 'male'|'female',
//         dateOfBirth: 'YYYY-MM-DD', phone, studentId }
// response: { data: { user } }
//
// No token is reissued: the JWT identifies the account, and nothing this
// endpoint changes is carried in it. The client replaces its cached user with
// the one returned here.
router.post('/gather-info', requireAuth, addUserInfo);

export default router;
