import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import tutorRouter from './routes/tutor.routes';
import authRouter from './routes/auth.routes';
import quizRouter from './routes/quiz.routes';
import ragRouter from './routes/rag.routes';
import careerRouter from './routes/career.routes';
import placementRouter from './routes/placement.routes';
import codingRouter from './routes/coding.routes';
import plannerRouter from './routes/planner.routes';
import analyticsRouter from './routes/analytics.routes';
import revisionRouter from './routes/revision.routes';
import diagnosticsRouter from './routes/diagnostics.routes';
import { errorHandler, AppError } from './middleware/error.middleware';

const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

import { apiLimiter } from './middleware/rateLimit.middleware';
// Apply the rate limiting middleware to all API requests
app.use('/api', apiLimiter);

// Serve static frontend files from 'public' directory (kept as legacy support/fallback)
app.use(express.static(path.join(__dirname, '../public')));

// Server health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'AI Tutor Backend is healthy and running.',
    timestamp: new Date().toISOString(),
  });
});

// Register API Routes
app.use('/api/auth', authRouter);
app.use('/api/tutor', tutorRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/rag', ragRouter);
app.use('/api/career', careerRouter);
app.use('/api/placement', placementRouter);
app.use('/api/coding', codingRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/revision', revisionRouter);
app.use('/api/diagnostics', diagnosticsRouter);

// Catch-all route handler for undefined endpoints (404)
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find requested path ${req.originalUrl} on this server.`, 404));
});

// Global Error Handling Middleware (must be registered last)
app.use(errorHandler);

export default app;
