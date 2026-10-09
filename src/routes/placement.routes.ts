import { moduleInputs, validateModule } from '../middleware/module-validation';
import { Router } from 'express';
import { analyzeResume, chatMockInterview, getPracticeChallenge } from '../controllers/placement.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/placement/resume
router.post('/resume', authMiddleware as any, validateModule(moduleInputs.resume), analyzeResume);

// POST /api/placement/interview
router.post('/interview', authMiddleware as any, validateModule(moduleInputs.interview), chatMockInterview);

// GET /api/placement/practice
router.get('/practice', authMiddleware as any, validateModule(moduleInputs.practice, 'query'), getPracticeChallenge);

export default router;
