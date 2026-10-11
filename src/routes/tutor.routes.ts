import { Router } from 'express';
import { askQuestion, askQuestionStream, listConversations, getConversation, deleteConversation, restoreConversation } from '../controllers/tutor.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/conversations', authMiddleware as any, listConversations);
router.get('/conversations/:id', authMiddleware as any, getConversation);
router.delete('/conversations/:id', authMiddleware as any, deleteConversation);
router.post('/conversations/:id/restore', authMiddleware as any, restoreConversation);

// POST /api/tutor/ask (Regular JSON response)
router.post('/ask', authMiddleware as any, askQuestion);

// GET /api/tutor/ask/stream (Server-Sent Events streaming response)
router.post('/ask/stream', authMiddleware as any, askQuestionStream);
router.get('/ask/stream', authMiddleware as any, askQuestionStream);

export default router;
