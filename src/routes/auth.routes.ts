import { Router } from 'express';
import { register, login, saveProfile, getProfile } from '../controllers/auth.controller';
import { supabaseWebhook } from '../controllers/webhook.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateAuthBody, signupSchema, loginSchema } from '../middleware/validation.middleware';
import { loginLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', validateAuthBody(signupSchema), register);

// POST /api/auth/login
router.post('/login', loginLimiter, validateAuthBody(loginSchema), login);

// POST /api/auth/webhook (Supabase Auth user sync trigger)
router.post('/webhook', supabaseWebhook);

// POST /api/auth/profile (Save profile onboarding)
router.post('/profile', authMiddleware as any, saveProfile);

// GET /api/auth/profile (Retrieve profile onboarding)
router.get('/profile', authMiddleware as any, getProfile);

export default router;
