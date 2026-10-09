import { moduleInputs, validateModule } from '../middleware/module-validation';
import { Router } from 'express';
import { generateExercise, reviewSubmission } from '../controllers/coding.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/coding/exercise
router.post('/exercise', authMiddleware as any, validateModule(moduleInputs.exercise), generateExercise);

// POST /api/coding/review
router.post('/review', authMiddleware as any, validateModule(moduleInputs.review), reviewSubmission);

export default router;
