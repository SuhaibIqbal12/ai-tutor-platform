import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { diagnosticsService } from '../services/diagnostics.service';

// Helper function to sanitize string inputs by stripping HTML/script tags and special characters
export function sanitizeString(val: any): any {
  if (typeof val !== 'string') {
    return val;
  }
  // Strip HTML and script tags
  let cleaned = val.replace(/<[^>]*>/g, '');
  // Strip dangerous special characters: <, >, &, ", ', /, \, `, $, ;, (, )
  cleaned = cleaned.replace(/[<>&"'/\\`$;()]/g, '');
  return cleaned.trim();
}

// Sanitizes all string properties in a request body recursively
export function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }
  const sanitized: any = Array.isArray(body) ? [] : {};
  for (const key in body) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const val = body[key];
      if (typeof val === 'string') {
        sanitized[key] = sanitizeString(val);
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = sanitizeBody(val);
      } else {
        sanitized[key] = val;
      }
    }
  }
  return sanitized;
}

// Signup Zod Validation Schema
export const signupSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(8).max(100).regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: "Password must contain at least one letter and one number"
  }),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().min(2).max(50).regex(/^[a-zA-Z\s.-]+$/).optional()
});

// Login Zod Validation Schema
export const loginSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(8).max(100)
});

// Generic validation middleware creator
export const validateAuthBody = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Sanitize request body
      req.body = sanitizeBody(req.body);

      // 2. Validate using Zod schema
      await schema.parseAsync(req.body);
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Log validation failures server-side for monitoring
        const issues = (error as any).issues || (error as any).errors || [];
        console.error('[Validation Failure]', issues);
        try {
          diagnosticsService.log('ai_request', 'Auth request failed input validation check', {
            errors: issues.map((e: any) => ({ field: (e.path || []).join('.'), message: e.message })),
            ip: req.ip
          });
        } catch (_) {}

        // Return a generic error message (do not expose which field failed specifically)
        res.status(400).json({
          status: 'fail',
          message: 'Invalid request inputs. Please check your details and try again.'
        });
        return;
      }
      next(error);
    }
  };
};
