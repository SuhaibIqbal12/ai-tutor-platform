import { Router } from 'express';
import { generateQuiz, submitAttempt, getHistory } from '../controllers/quiz.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Routes for quizzes (all protected by authMiddleware)
// POST /api/quiz/generate
router.post('/generate', authMiddleware as any, generateQuiz);

// POST /api/quiz/submit
router.post('/submit', authMiddleware as any, submitAttempt);

// GET /api/quiz/history
router.get('/history', authMiddleware as any, getHistory);

export default router;
