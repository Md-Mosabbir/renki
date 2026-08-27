import { Router } from 'express';

import { getAdminReports, patchAdminReport } from '../controllers/reports.controller.js';
import {
  getChallengeQueue,
  patchChallenge,
  postChallenge,
} from '../controllers/verification.controller.js';
import { postReinstate, postSuspend } from '../controllers/moderation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';

/**
 * Moderator-only routes.
 *
 * requireAdmin is mounted once on the router rather than per route, so a route
 * added here cannot be added without it. It answers 404 rather than 403: to a
 * student who is not a moderator, this surface does not exist.
 */
const router = Router();

router.use(requireAuth, requireAdmin);

// GET   /api/admin/reports?status=&limit=&offset=   the queue, oldest first
// PATCH /api/admin/reports/:id                      body: { status }
router.get('/reports', getAdminReports);
router.patch('/reports/:id', patchAdminReport);

// POST /api/admin/reports/:id/suspend   body: { reason? }
// POST /api/admin/users/:id/reinstate
//
// The queue had no teeth until these landed: every reason could be filed, read
// and marked resolved, and the only suspension in the codebase was the one at
// the end of a gender challenge. Suspending is addressed to a REPORT so the
// decision always has a cause on file; reinstating is addressed to a user,
// because there is nothing left to attach it to.
router.post('/reports/:id/suspend', postSuspend);
router.post('/users/:id/reinstate', postReinstate);

// GET   /api/admin/challenges        cases awaiting a decision, oldest first
// POST  /api/admin/challenges        body: { userId, reportId? }  -> ask
// PATCH /api/admin/challenges/:id    body: { cleared, note? }     -> rule
//
// Issuing is a separate, deliberate act from reading the report that prompted
// it. A report alone must never compel somebody to photograph themselves.
router.get('/challenges', getChallengeQueue);
router.post('/challenges', postChallenge);
router.patch('/challenges/:id', patchChallenge);

export default router;
