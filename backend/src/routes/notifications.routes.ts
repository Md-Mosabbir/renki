import { Router } from 'express';

import {
  getNotifications,
  postRead,
  postReadAll,
} from '../controllers/notifications.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.post('/read-all', postReadAll);
router.post('/:id/read', postRead);

export default router;
