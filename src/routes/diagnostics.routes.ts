import { Router } from 'express';
import { getHealth, getLogs } from '../controllers/diagnostics.controller';

const router = Router();

// GET /api/diagnostics/health (public or authenticated, let's keep public for simple Navbar health checks)
router.get('/health', getHealth);

// GET /api/diagnostics/logs
router.get('/logs', getLogs);

export default router;
