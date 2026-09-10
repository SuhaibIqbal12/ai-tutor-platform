import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CareerAgent } from '../agents/career.agent';
import { prisma } from '../config/prisma';

const careerAgent = new CareerAgent();

/**
 * Controller endpoint to generate or retrieve a student's personalized career roadmap.
 */
export const getCareerRoadmap = async (
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

    // Fetch user profile and placement details to supply to Career Coach
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      res.status(400).json({
        status: 'fail',
        message: 'Please complete your onboarding profile first so the Career Coach can understand your major and interests!'
      });
      return;
    }

    const placementProfile = await prisma.placementProfile.findUnique({ where: { userId } });
    const existingSkills = placementProfile?.skills ? JSON.parse(placementProfile.skills) : [];

    const studentProfile = {
      academicYear: profile.academicYear,
      branch: profile.branch,
      cgpa: profile.cgpa,
      strongSubjects: JSON.parse(profile.strongSubjects || '[]'),
      weakSubjects: JSON.parse(profile.weakSubjects || '[]'),
      learningPreferences: JSON.parse(profile.learningPreferences || '[]'),
      careerInterests: JSON.parse(profile.careerInterests || '[]'),
      learningStyle: profile.learningStyle || 'Mixed',
      currentLevel: profile.currentLevel || 'Intermediate',
      knowledgeGaps: JSON.parse(profile.knowledgeGaps || '[]'),
      retentionRate: profile.retentionRate || 75,
      studyConsistency: profile.studyConsistency || 50,
      confidenceLevel: profile.confidenceLevel || 70,
      codingGrowthScore: profile.codingGrowthScore || 0,
      learningVelocity: profile.learningVelocity || 1.0
    };

    const roadmap = await careerAgent.generateCareerPlan(studentProfile, existingSkills);

    // Save progressive goals back in the placement profile for dashboard view
    await prisma.placementProfile.upsert({
      where: { userId },
      update: {
        weeklyGoals: JSON.stringify(roadmap.weeklyGoals || []),
        monthlyGoals: JSON.stringify(roadmap.monthlyGoals || [])
      },
      create: {
        userId,
        weeklyGoals: JSON.stringify(roadmap.weeklyGoals || []),
        monthlyGoals: JSON.stringify(roadmap.monthlyGoals || []),
        readinessScore: 30 // Seed default score
      }
    });

    res.status(200).json({
      status: 'success',
      data: roadmap
    });
  } catch (err) {
    next(err);
  }
};
