import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Response, NextFunction } from 'express';
import { diagnosticsService } from '../services/diagnostics.service';

/**
 * Controller endpoint to get health statistics of AI Tutor backend.
 */
export const getHealth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const health = await diagnosticsService.getHealthStats(req.user!.id);
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
export const getLogs = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const logs = diagnosticsService.getLogs(req.user!.id);
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
