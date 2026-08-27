import { Router } from 'express';

import {
  deleteRideRequest,
  getDeck,
  getHistory,
  getIncoming,
  getOpenRequest,
  postRideRequest,
  postSwipe,
} from '../controllers/rides.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { DECK, throttled } from '../middlewares/throttled.handler.proxy.js';

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

// GET /api/rides/history?limit=&offset=  — rides that are over.
// Also before /request/:id, for the same reason.
router.get('/history', getHistory);

router.get('/request', getOpenRequest);
router.post('/request', postRideRequest);
router.delete('/request/:id', deleteRideRequest);
router.get('/request/:id/deck', throttled(DECK, getDeck));
router.post('/request/:id/swipe', postSwipe);

export default router;
