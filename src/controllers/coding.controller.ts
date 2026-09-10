import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CodingAgent } from '../agents/coding.agent';
import { prisma } from '../config/prisma';

const codingAgent = new CodingAgent();

/**
 * Controller endpoint to request a dynamic coding exercise.
 */
export const generateExercise = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { language, topic, difficulty } = req.body;
    const userId = req.user?.id;

    let studentProfile;
    if (userId) {
      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (profile) {
        studentProfile = {
          currentLevel: profile.currentLevel || 'Intermediate',
          learningStyle: profile.learningStyle || 'Mixed'
        };
      }
    }

    const exercise = await codingAgent.generateCodingExercise(language, topic, difficulty || 'medium', studentProfile);
    
    res.status(200).json({
      status: 'success',
      data: exercise
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller endpoint to submit and evaluate code.
 */
export const reviewSubmission = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { language, problemTitle, description, studentCode } = req.body;
    const userId = req.user?.id;

    let studentProfile;
    if (userId) {
      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      if (profile) {
        studentProfile = {
          currentLevel: profile.currentLevel || 'Intermediate',
          learningStyle: profile.learningStyle || 'Mixed'
        };
      }
    }

    const review = await codingAgent.reviewCodeSubmission(
      language,
      problemTitle,
      description,
      studentCode,
      studentProfile
    );

    // Update PlacementProfile statistics and readiness score!
    if (userId) {
      const isSql = language.toLowerCase() === 'sql' || language.toLowerCase() === 'postgresql';
      const placementProfile = await prisma.placementProfile.findUnique({ where: { userId } });
      
      if (placementProfile) {
        const increment = review.isCorrect ? 5 : 2;
        await prisma.placementProfile.update({
          where: { userId },
          data: {
            practiceCodeCount: isSql ? placementProfile.practiceCodeCount : placementProfile.practiceCodeCount + 1,
            practiceSQLCount: isSql ? placementProfile.practiceSQLCount + 1 : placementProfile.practiceSQLCount,
            readinessScore: Math.min((placementProfile.readinessScore || 0) + increment, 100)
          }
        });
      } else {
        await prisma.placementProfile.create({
          data: {
            userId,
            practiceCodeCount: isSql ? 0 : 1,
            practiceSQLCount: isSql ? 1 : 0,
            readinessScore: review.isCorrect ? 35 : 32
          }
        });
      }

      // Phase 2: Update Learning DNA codingGrowthScore
      if (review.isCorrect) {
        await prisma.userProfile.update({
          where: { userId },
          data: { codingGrowthScore: { increment: 1.5 } }
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: review
    });
  } catch (err) {
    next(err);
  }
};
