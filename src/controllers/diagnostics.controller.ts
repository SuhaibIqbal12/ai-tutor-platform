import { Request, Response, NextFunction } from 'express';
import { diagnosticsService } from '../services/diagnostics.service';

/**
 * Controller endpoint to get health statistics of AI Tutor backend.
 */
export const getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await diagnosticsService.getHealthStats();
    res.status(200).json({
      status: 'success',
      data: health
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to get diagnostics logs.
 */
export const getLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const logs = diagnosticsService.getLogs();
    res.status(200).json({
      status: 'success',
      data: {
        logs
      }
    });
  } catch (error) {
    next(error);
  }
};
