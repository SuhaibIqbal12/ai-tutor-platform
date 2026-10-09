import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const label = z.string().trim().min(1).max(200);
const text = z.string().trim().min(1).max(50000);
export const moduleInputs = {
  exercise: z.object({ language: label, topic: label, difficulty: z.enum(['easy', 'medium', 'hard']).default('medium') }),
  review: z.object({ language: label, problemTitle: label, description: text, studentCode: z.string().min(1).max(50000) }),
  resume: z.object({ resumeText: text, targetRole: label.default('Software Engineer') }),
  interview: z.object({ type: z.enum(['Technical', 'HR']), history: z.array(z.object({ role: z.enum(['interviewer', 'student']), text })).max(100).default([]), studentAnswer: text.optional() }),
  practice: z.object({ type: z.enum(['aptitude', 'sql', 'system_design']).default('aptitude') }),
  plan: z.object({ examDate: z.iso.date().refine(value => new Date(value + 'T23:59:59Z').getTime() >= Date.now(), 'Choose today or a future exam date.'), availableHours: z.coerce.number().min(0.25).max(16).default(2), academicGoal: label.default('Acquire thorough conceptual mastery') }),
};
export function validateModule(schema: z.ZodType, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      res.status(400).json({ status: 'fail', message: 'Invalid request. Check the required fields and allowed values.' });
      return;
    }
    if (source === 'body') req.body = parsed.data;
    // Query defaults are already applied by the controller; Express query may be read-only.
    next();
  };
}
