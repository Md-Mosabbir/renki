import { Router } from 'express';

import { getDestinations } from '../controllers/destinations.controller.js';

const router = Router();

// GET /api/destinations
// response: { data: { destinations: [{ id, label, area, kind, latitude, longitude }] } }
router.get('/', getDestinations);

export default router;
