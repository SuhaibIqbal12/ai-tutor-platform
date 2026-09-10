import { Router } from 'express';
import { analyzeResume, chatMockInterview, getPracticeChallenge } from '../controllers/placement.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/placement/resume
router.post('/resume', authMiddleware as any, analyzeResume);

// POST /api/placement/interview
router.post('/interview', authMiddleware as any, chatMockInterview);

// GET /api/placement/practice
router.get('/practice', authMiddleware as any, getPracticeChallenge);

export default router;
