import { moduleInputs, validateModule } from '../middleware/module-validation';
import { Router } from 'express';
import { generatePlan, getLatestPlan } from '../controllers/planner.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/planner/generate
router.post('/generate', authMiddleware as any, validateModule(moduleInputs.plan), generatePlan);

// GET /api/planner/latest
router.get('/latest', authMiddleware as any, getLatestPlan);

export default router;
