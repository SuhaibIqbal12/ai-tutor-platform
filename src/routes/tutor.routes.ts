import { Router } from 'express';
import { askQuestion, askQuestionStream } from '../controllers/tutor.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// POST /api/tutor/ask (Regular JSON response)
router.post('/ask', authMiddleware as any, askQuestion);

// GET /api/tutor/ask/stream (Server-Sent Events streaming response)
router.get('/ask/stream', authMiddleware as any, askQuestionStream);

export default router;
