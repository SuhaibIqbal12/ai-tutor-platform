import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getHealth, getLogs } from '../controllers/diagnostics.controller';

const router = Router();

// GET /api/diagnostics/health (public or authenticated, let's keep public for simple Navbar health checks)
router.get('/health', authMiddleware as any, getHealth);

// GET /api/diagnostics/logs
router.get('/logs', authMiddleware as any, getLogs);

export default router;
