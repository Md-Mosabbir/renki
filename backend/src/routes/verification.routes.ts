import { Router } from 'express';

import {
  postSelfVerification,
  verifyGender,
} from '../controllers/verification.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * POST /api/verification/gender
 * Accepts gender verification payload & 128D facial feature vector
 */
router.post('/gender', verifyGender);

/**
 * POST /api/verification/self
 * header: Authorization: Bearer <token>
 * response: { data: { user } }
 *
 * PLACEHOLDER. Verifies the caller with no evidence, so the app has something
 * behind its Verify button while capture and matching are unbuilt. Disabled
 * under NODE_ENV=production by the service.
 */
router.post('/self', requireAuth, postSelfVerification);

export default router;
