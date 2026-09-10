import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { RevisionAgent } from '../agents/revision.agent';

const revisionAgent = new RevisionAgent();

/**
 * Controller endpoint to retrieve topic mastery heatmap data.
 */
export const getHeatmap = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const data = await revisionAgent.getHeatmapData(userId);
    res.status(200).json({
      status: 'success',
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller endpoint to generate custom AI revision schedules and reminders.
 */
export const getRevisionPlan = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const plan = await revisionAgent.generateRevisionPlan(userId);
    res.status(200).json({
      status: 'success',
      data: { plan }
    });
  } catch (err) {
    next(err);
  }
};
