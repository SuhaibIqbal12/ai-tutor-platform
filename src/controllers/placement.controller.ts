import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PlacementAgent } from '../agents/placement.agent';
import { prisma } from '../config/prisma';

const placementAgent = new PlacementAgent();

/**
 * Controller endpoint to submit resume text for ATS checking and skills mapping.
 */
export const analyzeResume = async (
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

    const { resumeText, targetRole } = req.body;
    const analysis = await placementAgent.analyzeResume(resumeText, targetRole || 'Software Engineer');

    // Update PlacementProfile with ATS score and identified skills
    const updatedProfile = await prisma.placementProfile.upsert({
      where: { userId },
      update: {
        resumeText,
        atsScore: analysis.atsScore,
        skills: JSON.stringify(analysis.skillsIdentified || []),
        readinessScore: Math.min(Math.round((analysis.atsScore + 40) / 1.5), 100) // Formulate composite readiness score
      },
      create: {
        userId,
        resumeText,
        atsScore: analysis.atsScore,
        skills: JSON.stringify(analysis.skillsIdentified || []),
        readinessScore: Math.min(Math.round((analysis.atsScore + 40) / 1.5), 100)
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        analysis,
        readinessScore: updatedProfile.readinessScore
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller endpoint to submit student responses and get the next Mock Interview query.
 */
export const chatMockInterview = async (
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

    const { type, history, studentAnswer } = req.body; // type = 'Technical' | 'HR'
    const result = await placementAgent.getMockInterviewResponse(type, history || [], studentAnswer);

    // If session ended and we have a scorecard, save the interview score
    if (result.endSession && result.scorecard) {
      const interviewScore = result.scorecard.overallScore || 0;
      const profile = await prisma.placementProfile.findUnique({ where: { userId } });
      if (profile) {
        // Save the interview score (out of 10 → converted to 0-100 scale for readinessScore)
        await prisma.placementProfile.update({
          where: { id: profile.id },
          data: {
            readinessScore: Math.min((profile.readinessScore || 0) + interviewScore, 100)
          }
        });
      } else {
        await prisma.placementProfile.create({
          data: {
            userId,
            resumeText: '',
            atsScore: 0,
            readinessScore: interviewScore * 10,
            skills: JSON.stringify([])
          }
        });
      }
    } else if (studentAnswer && studentAnswer.length > 5) {
      // Boost readiness score on active participation during ongoing session
      const profile = await prisma.placementProfile.findUnique({ where: { userId } });
      if (profile) {
        const increment = type === 'Technical' ? 3 : 2;
        await prisma.placementProfile.update({
          where: { id: profile.id },
          data: {
            readinessScore: Math.min((profile.readinessScore || 0) + increment, 100)
          }
        });
      }
    }

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller endpoint to retrieve Aptitude, SQL, or System Design practice sets.
 */
export const getPracticeChallenge = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type } = req.query; // aptitude, sql, system_design
    const challenge = await placementAgent.generatePlacementPractice(type as any || 'aptitude');

    res.status(200).json({
      status: 'success',
      data: challenge
    });
  } catch (err) {
    next(err);
  }
};
