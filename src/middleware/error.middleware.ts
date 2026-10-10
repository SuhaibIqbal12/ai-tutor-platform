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
  const multer = err as Error & { code?: string };
  const statusCode = multer.code === 'LIMIT_FILE_SIZE' ? 413 : err instanceof AppError ? err.statusCode : 500;
  const message = multer.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 4 MB. Split or compress it and try again.' :
    err instanceof AppError && err.isOperational ? err.message :
    statusCode >= 500 ? 'Service unavailable. Please retry; if this continues, check the application configuration and diagnostics.' : err.message;
  // Raw SDK/database errors can contain connection URLs, keys, or student text.
  console.error(`[API] Request failed with status ${statusCode}`);
  res.status(statusCode).json({ status: 'error', statusCode, message });
};
