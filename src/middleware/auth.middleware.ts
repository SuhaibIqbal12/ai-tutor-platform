import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { AppError } from './error.middleware';
import { prisma } from '../config/prisma';
import { getJwtSecret } from '../services/auth.service';
import { requestContext } from '../services/request-context';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email?: string };
}
export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    // Legacy EventSource client still supplies the token in its query string.
    const token = header?.startsWith('Bearer ') ? header.slice(7) : (typeof req.query.token === 'string' ? req.query.token : '');
    if (!token) throw new AppError('Authentication required.', 401);
    let identity: { id: string; email?: string } | undefined;
    try {
      const claims = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'], issuer: 'ai-tutor', audience: 'ai-tutor' }) as jwt.JwtPayload;
      if (typeof claims.sub === 'string') identity = { id: claims.sub, email: claims.email };
    } catch { /* An independently verified Supabase session is also supported. */ }
    if (!identity && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data, error } = await client.auth.getUser(token);
      if (!error && data.user) {
        identity = { id: data.user.id, email: data.user.email };
        // Verified OAuth can recover a legacy passwordless account without changing its data ownership.
        const existing = data.user.email_confirmed_at && identity.email
          ? await prisma.user.findUnique({ where: { email: identity.email } }) : null;
        if (existing) identity.id = existing.id;
        else await prisma.user.upsert({ where: { id: identity.id }, update: {}, create: { id: identity.id, email: identity.email } });
      }
    }
    if (!identity) throw new AppError('Invalid or expired session. Please sign in again.', 401);
    const user = await prisma.user.findUnique({ where: { id: identity.id }, select: { id: true } });
    if (!user) throw new AppError('Account not found. Please sign in again.', 401);
    req.user = identity;
    requestContext.run({ userId: identity.id }, next);
  } catch (error) { next(error); }
};
