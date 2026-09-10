import { Router } from 'express';
import { getDashboardStats } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// GET /api/analytics/dashboard
router.get('/dashboard', authMiddleware as any, getDashboardStats);

export default router;
