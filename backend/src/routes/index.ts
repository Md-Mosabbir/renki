import { Router } from 'express';
import greetingRoutes from './greeting.routes.js';
import healthRoutes from './health.routes.js';

/**
 * ROUTES — the URL map. Every feature mounts its own router here, so there is
 * exactly one file to open when you ask "what endpoints does this API have?".
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/hello', greetingRoutes);

export default router;
