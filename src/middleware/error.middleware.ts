import { Request, Response, NextFunction } from 'express';

/**
 * Custom application error class to handle operational errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express error middleware to handle all thrown errors in the application.
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  // Log the error stack in development or for critical server errors (500)
  console.error(`[API Error] ${statusCode} - ${message}`);
  if (statusCode === 500) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
