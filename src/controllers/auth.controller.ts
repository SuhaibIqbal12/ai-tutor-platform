import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';

/**
 * Controller endpoint for handling user registration (test stub returning Supabase JWT format).
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const mockId = `mock_user_${crypto.createHash('md5').update(email).digest('hex')}`;

    // Find or create user record by email to avoid unique constraint conflicts
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { id: mockId, email } });
    }

    const secret = process.env.SUPABASE_JWT_SECRET || 'super_secure_supabase_jwt_secret_for_local_testing';
    const token = jwt.sign({ sub: user.id, email }, secret, { expiresIn: '24h' });

    res.status(201).json({
      status: 'success',
      data: {
        user: { id: user.id, email },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint for handling user login (test stub returning Supabase JWT format).
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const mockId = `mock_user_${crypto.createHash('md5').update(email).digest('hex')}`;

    // Find or create user record by email to avoid unique constraint conflicts
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { id: mockId, email } });
    }

    const secret = process.env.SUPABASE_JWT_SECRET || 'super_secure_supabase_jwt_secret_for_local_testing';
    const token = jwt.sign({ sub: user.id, email }, secret, { expiresIn: '24h' });

    res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, email },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Saves or updates student profile onboarding data.
 */
export const saveProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to save profile.',
      });
      return;
    }

    const {
      academicYear,
      branch,
      cgpa,
      strongSubjects,
      weakSubjects,
      learningPreferences,
      careerInterests
    } = req.body;

    const cgpaFloat = parseFloat(cgpa || '0');
    const level = cgpaFloat >= 8.5 ? 'Advanced' : cgpaFloat >= 6.5 ? 'Intermediate' : 'Beginner';
    const parsedStyle = learningPreferences && learningPreferences.length > 0 ? learningPreferences[0] : 'Mixed';

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        academicYear,
        branch,
        cgpa: cgpaFloat,
        strongSubjects: JSON.stringify(strongSubjects || []),
        weakSubjects: JSON.stringify(weakSubjects || []),
        learningPreferences: JSON.stringify(learningPreferences || []),
        careerInterests: JSON.stringify(careerInterests || []),
        learningStyle: req.body.learningStyle || parsedStyle,
        currentLevel: req.body.currentLevel || level,
        knowledgeGaps: req.body.knowledgeGaps ? JSON.stringify(req.body.knowledgeGaps) : JSON.stringify(weakSubjects || []),
        retentionRate: req.body.retentionRate !== undefined ? parseFloat(req.body.retentionRate) : undefined,
        studyConsistency: req.body.studyConsistency !== undefined ? parseFloat(req.body.studyConsistency) : undefined,
        confidenceLevel: req.body.confidenceLevel !== undefined ? parseFloat(req.body.confidenceLevel) : undefined
      },
      create: {
        userId,
        academicYear,
        branch,
        cgpa: cgpaFloat,
        strongSubjects: JSON.stringify(strongSubjects || []),
        weakSubjects: JSON.stringify(weakSubjects || []),
        learningPreferences: JSON.stringify(learningPreferences || []),
        careerInterests: JSON.stringify(careerInterests || []),
        learningStyle: req.body.learningStyle || parsedStyle,
        currentLevel: req.body.currentLevel || level,
        knowledgeGaps: req.body.knowledgeGaps ? JSON.stringify(req.body.knowledgeGaps) : JSON.stringify(weakSubjects || []),
        retentionRate: req.body.retentionRate !== undefined ? parseFloat(req.body.retentionRate) : 75.0,
        studyConsistency: req.body.studyConsistency !== undefined ? parseFloat(req.body.studyConsistency) : 50.0,
        confidenceLevel: req.body.confidenceLevel !== undefined ? parseFloat(req.body.confidenceLevel) : 70.0
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        profile: {
          ...profile,
          strongSubjects: JSON.parse(profile.strongSubjects),
          weakSubjects: JSON.parse(profile.weakSubjects),
          learningPreferences: JSON.parse(profile.learningPreferences),
          careerInterests: JSON.parse(profile.careerInterests),
          learningStyle: profile.learningStyle || 'Mixed',
          currentLevel: profile.currentLevel || (profile.cgpa >= 8.5 ? 'Advanced' : 'Intermediate'),
          knowledgeGaps: JSON.parse(profile.knowledgeGaps || '[]'),
          retentionRate: profile.retentionRate ?? 75.0,
          studyConsistency: profile.studyConsistency ?? 50.0,
          confidenceLevel: profile.confidenceLevel ?? 70.0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the student profile onboarding details.
 */
export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to fetch profile.',
      });
      return;
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!profile) {
      res.status(200).json({
        status: 'success',
        data: { profile: null }
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        profile: {
          ...profile,
          strongSubjects: JSON.parse(profile.strongSubjects),
          weakSubjects: JSON.parse(profile.weakSubjects),
          learningPreferences: JSON.parse(profile.learningPreferences),
          careerInterests: JSON.parse(profile.careerInterests),
          learningStyle: profile.learningStyle || 'Mixed',
          currentLevel: profile.currentLevel || (profile.cgpa >= 8.5 ? 'Advanced' : 'Intermediate'),
          knowledgeGaps: JSON.parse(profile.knowledgeGaps || '[]'),
          retentionRate: profile.retentionRate ?? 75.0,
          studyConsistency: profile.studyConsistency ?? 50.0,
          confidenceLevel: profile.confidenceLevel ?? 70.0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
