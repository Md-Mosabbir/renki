import { Router } from 'express';

import {
  deleteRideRequest,
  getDeck,
  getIncoming,
  getOpenRequest,
  postRideRequest,
  postSwipe,
} from '../controllers/rides.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// GET    /api/rides/request              the one open search, or null
// POST   /api/rides/request              body: { destination, departureTime }
// DELETE /api/rides/request/:id          cancel it
// GET    /api/rides/request/:id/deck     the swipe deck
// POST   /api/rides/request/:id/swipe    body: { otherRequestId, accept }
//
// A stranger ride exists only once BOTH sides swipe yes — see
// services/ride-request.service.ts.
// GET /api/rides/incoming — who has already swiped yes on me.
// Declared before /request/:id so it cannot be read as a request id.
router.get('/incoming', getIncoming);

router.get('/request', getOpenRequest);
router.post('/request', postRideRequest);
router.delete('/request/:id', deleteRideRequest);
router.get('/request/:id/deck', getDeck);
router.post('/request/:id/swipe', postSwipe);

export default router;
