import { Router } from 'express';

import { env } from '../config/env.js';
import greetingRoutes from './greeting.routes.js';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import verificationRoutes from './verification.routes.js';
import destinationsRoutes from './destinations.routes.js';
import friendsRoutes from './friends.routes.js';
import groupsRoutes from './groups.routes.js';
import ridesRoutes from './rides.routes.js';
import devRoutes from './dev.routes.js';

/**
 * ROUTES — the URL map. Every feature mounts its own router here, so there is
 * exactly one file to open when you ask "what endpoints does this API have?".
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/hello', greetingRoutes);
router.use('/auth', authRoutes);
router.use('/verification', verificationRoutes);
router.use('/destinations', destinationsRoutes);
router.use('/friends', friendsRoutes);
router.use('/groups', groupsRoutes);
router.use('/rides', ridesRoutes);

// Development only, and mounted conditionally rather than guarded inside: in
// production these URLs do not exist at all, which is a stronger guarantee than
// a handler that decides to refuse. See controllers/dev.controller.ts.
if (!env.isProduction) {
  router.use('/dev', devRoutes);
}

export default router;
