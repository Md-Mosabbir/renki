import { Router } from 'express';

import {
  deleteFriendship,
  getCandidates,
  getFriendGraph,
  getFriends,
  getFriendship,
  postBlockUser,
  postFriendRequest,
  postFriendResponse,
  postMeetupCode,
  postMeetupScan,
} from '../controllers/friends.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { CODE_ISSUE, throttled } from '../middlewares/throttled.handler.proxy.js';

const router = Router();

// Everything below needs a session — mounted once rather than repeated on each
// line, so a new route cannot be added without it.
router.use(requireAuth);

// GET /api/friends
// response: { data: { friends, awaitingMeetup, incoming, outgoing } }
router.get('/', getFriends);

// GET /api/friends/discover?q=<name or student id>
// Same-gender, same-university, not already connected. Filtered in SQL.
router.get('/discover', getCandidates);

// GET /api/friends/graph
// My confirmed friends plus the edges between them, for the group builder.
// Declared before /:id so 'graph' is never read as an id.
router.get('/graph', getFriendGraph);

// POST /api/friends/requests   body: { userId }
// If they already requested you, this accepts theirs instead of creating a second row.
router.post('/requests', postFriendRequest);

// POST /api/friends/block   body: { userId }
// Blocks anyone, friendship or not. Declared before the /:id routes so 'block'
// is never read as a friendship id.
router.post('/block', postBlockUser);

// POST /api/friends/meetups/scan   body: { code }
// The moment a friendship becomes real. Declared before the /:id routes so a
// future param pattern cannot start swallowing it.
router.post('/meetups/scan', postMeetupScan);

// GET    /api/friends/:id
// DELETE /api/friends/:id                  withdraw a request, or unfriend
// POST   /api/friends/:id/respond          body: { action: 'accept'|'decline'|'block' }
// POST   /api/friends/:id/meetup           mint the code to display
router.get('/:id', getFriendship);
router.delete('/:id', deleteFriendship);
router.post('/:id/respond', postFriendResponse);
router.post('/:id/meetup', throttled(CODE_ISSUE, postMeetupCode));

export default router;
