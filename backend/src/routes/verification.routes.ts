import { Router } from 'express';
import { verifyGender } from '../controllers/verification.controller.js';

const router = Router();

/**
 * POST /api/verification/gender
 * Accepts gender verification payload & 128D facial feature vector
 */
router.post('/gender', verifyGender);

export default router;
