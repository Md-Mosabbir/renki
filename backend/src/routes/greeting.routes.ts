import { Router } from 'express';
import { getGreeting } from '../controllers/greeting.controller.js';

const router = Router();

// GET /api/hello?name=Renki
router.get('/', getGreeting);

export default router;
