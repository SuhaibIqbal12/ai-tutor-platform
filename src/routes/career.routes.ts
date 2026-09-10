import { Router } from 'express';
import { getCareerRoadmap } from '../controllers/career.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/career/roadmap
router.post('/roadmap', authMiddleware as any, getCareerRoadmap);

export default router;
