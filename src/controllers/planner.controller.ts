import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PlannerAgent } from '../agents/planner.agent';

const plannerAgent = new PlannerAgent();

/**
 * Controller endpoint to request a new study schedule based on exam target dates.
 */
export const generatePlan = async (
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

    const { examDate, availableHours, academicGoal } = req.body;
    const plan = await plannerAgent.generateStudyPlan(
      userId,
      examDate,
      parseFloat(availableHours || '2'),
      academicGoal || 'Acquire thorough conceptual mastery'
    );

    res.status(200).json({
      status: 'success',
      data: plan
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller endpoint to get the student's latest study schedule.
 */
export const getLatestPlan = async (
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

    const plan = await plannerAgent.getLatestPlan(userId);
    
    res.status(200).json({
      status: 'success',
      data: { plan }
    });
  } catch (err) {
    next(err);
  }
};
