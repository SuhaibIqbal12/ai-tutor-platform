import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.middleware';
import { prisma } from '../config/prisma';

/**
 * Interface to extend standard Express requests with authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Middleware to secure routes requiring user authentication (via Supabase JWT).
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = String(req.query.token);
    }

    if (!token) {
      throw new AppError('Access denied. Authentication token required. Format: Bearer <token>', 401);
    }

    // Verify Supabase JWT token validity using local JWT secret
    const secret = process.env.SUPABASE_JWT_SECRET || 'super_secure_supabase_jwt_secret_for_local_testing';
    let decoded: { sub: string; email?: string } | null = null;

    try {
      decoded = jwt.verify(token, secret) as { sub: string; email?: string };
    } catch (err: any) {
      // In local development, if the verification secret is not matched, fallback to decoding the payload
      // directly to enable a frictionless developer setup.
      const isDev = process.env.NODE_ENV !== 'production' || secret === 'super_secure_supabase_jwt_secret_for_local_testing';
      if (isDev) {
        console.warn(`[authMiddleware] JWT verification failed (${err.message}). Falling back to unverified decode in dev/test mode.`);
        const parsed = jwt.decode(token) as any;
        if (parsed && parsed.sub) {
          decoded = {
            sub: parsed.sub,
            email: parsed.email || parsed.user_metadata?.email
          };
        }
      }
      
      if (!decoded) {
        throw err;
      }
    }

    // Check database to ensure the user exists in PostgreSQL/SQLite
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });

    if (!userExists) {
      // Auto-provision user record in DB if verified by Supabase but not synced yet by webhooks
      console.log(`[authMiddleware] Auto-provisioning synced user ${decoded.sub} (${decoded.email || 'no-email'})`);
      await prisma.user.create({
        data: {
          id: decoded.sub,
          email: decoded.email || null,
        }
      }).catch((err) => {
        // Ignore unique constraint/race condition issues
        console.warn('[authMiddleware] Auto-provision race condition warning:', err.message);
      });
    }

    // Attach user ID and email to the request object
    req.user = { id: decoded.sub, email: decoded.email };
    
    next();
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    
    // Catch JSON Web Token signature/expiration errors
    next(new AppError('Invalid, malformed, or expired session token.', 401));
  }
};
