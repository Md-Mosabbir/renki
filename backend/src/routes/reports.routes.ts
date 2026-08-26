import { Router } from 'express';

import { getMyReports, postReport } from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// POST /api/reports        body: { reportedUserId, reason, description?, rideGroupId? }
// GET  /api/reports/mine   reports I have filed
//
// Filing a report does NOT block anyone. Blocking is POST /api/friends/block —
// see report.service.ts for why the two are kept apart.
router.post('/', postReport);
router.get('/mine', getMyReports);

export default router;
