import { Router } from 'express';

import {
  getGroups,
  postCancel,
  postComplete,
  postGroup,
  postGroupResponse,
  postStartCode,
  postStartScan,
} from '../controllers/groups.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// GET  /api/groups
// POST /api/groups          body: { friendIds, destinationLocationId, departureTime }
// POST /api/groups/:id/respond   body: { accept: boolean }
//
// A group lands as 'forming' and becomes 'matched' only when every invited
// member has accepted. One decline cancels it.
router.get('/', getGroups);
router.post('/', postGroup);

// POST /api/groups/start/scan   body: { code }
// The moment a ride starts. Declared before the /:id routes so 'start' is
// never read as a group id.
router.post('/start/scan', postStartScan);

router.post('/:id/respond', postGroupResponse);

// matched --scan--> active --finish--> completed
// POST /api/groups/:id/start-code   mint the code to display
// POST /api/groups/:id/complete     end the ride
router.post('/:id/start-code', postStartCode);
router.post('/:id/complete', postComplete);
// POST /api/groups/:id/cancel      call it off (forming, matched or active)
router.post('/:id/cancel', postCancel);

export default router;
