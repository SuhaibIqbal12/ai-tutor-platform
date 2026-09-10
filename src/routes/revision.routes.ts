import { Router } from 'express';
import { getHeatmap, getRevisionPlan } from '../controllers/revision.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/revision/heatmap
router.get('/heatmap', authMiddleware as any, getHeatmap);

// GET /api/revision/plan
router.get('/plan', authMiddleware as any, getRevisionPlan);

export default router;
