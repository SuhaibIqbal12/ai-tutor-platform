import { Router } from 'express';
import { generateExercise, reviewSubmission } from '../controllers/coding.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/coding/exercise
router.post('/exercise', authMiddleware as any, generateExercise);

// POST /api/coding/review
router.post('/review', authMiddleware as any, reviewSubmission);

export default router;
