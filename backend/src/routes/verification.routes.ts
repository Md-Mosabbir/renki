import { Router } from 'express';

import {
  getMyChallenge,
  postChallengePhoto,
} from '../controllers/verification.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { acceptPhoto, handleUploadErrors } from '../middlewares/upload.middleware.js';

/**
 * The student's side of a gender challenge.
 *
 * There is no "verify me" endpoint here and there is not meant to be. Renki
 * checks nobody at signup; these two routes exist only for somebody a moderator
 * has actually asked a question of.
 *
 * What used to be mounted here: POST /gender (unauthenticated, wrote nothing,
 * always answered "verified") and POST /self (granted the trust stage with no
 * evidence at all). Both are gone.
 */
const router = Router();

router.use(requireAuth);

// GET  /api/verification/me      -> { challenge: ChallengeView | null }
router.get('/me', getMyChallenge);

// POST /api/verification/photo   multipart, one file in `photo`
//
// handleUploadErrors sits directly after the parser rather than at the app
// level: a MulterError reaching the generic handler is a 500 that says
// "Unexpected field", which is true and useless.
router.post('/photo', acceptPhoto, handleUploadErrors, postChallengePhoto);

export default router;
