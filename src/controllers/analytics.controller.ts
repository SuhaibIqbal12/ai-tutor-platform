import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AnalyticsAgent } from '../agents/analytics.agent';

const analyticsAgent = new AnalyticsAgent();

/**
 * Controller endpoint to retrieve computed analytics metrics and summaries.
 */
export const getDashboardStats = async (
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

    const stats = await analyticsAgent.getDashboardStats(userId);

    res.status(200).json({
      status: 'success',
      data: stats
    });
  } catch (err) {
    next(err);
  }
};
