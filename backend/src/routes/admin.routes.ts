import { Router } from 'express';

import { getAdminReports, patchAdminReport } from '../controllers/reports.controller.js';
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

export default router;
