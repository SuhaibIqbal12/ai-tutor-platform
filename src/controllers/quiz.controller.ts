import { QuizAgent } from '../agents/quiz.agent';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { QuizService } from '../services/quiz.service';

const quizService = new QuizService();
const quizAgent = new QuizAgent();

/**
 * Controller endpoint to generate a new quiz.
 */
export const generateQuiz = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { topic, questionCount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to generate a quiz.',
      });
      return;
    }

    if (typeof topic !== 'string' || !topic.trim() || topic.length > 200) throw new AppError('Provide a topic up to 200 characters.', 400);
    const count = questionCount ? Number(questionCount) : 5;
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new AppError('Question count must be between 1 and 20.', 400);
    const result = typeof req.body.isCodingTopic === 'boolean'
      ? await quizAgent.generateQuiz(userId, topic, req.body.isCodingTopic, req.body.ragMode === true, req.body.documentId)
      : await quizService.generateQuiz(userId, topic, count);

    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to submit answers and score a quiz.
 */
export const submitAttempt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { quizId, answers } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to submit answers.',
      });
      return;
    }

    if (!quizId || !Array.isArray(answers)) {
      res.status(400).json({
        status: 'fail',
        message: 'quizId and answers (array of integers) are required.',
      });
      return;
    }

    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, userId } });
    if (!quiz) throw new AppError('Quiz not found.', 404);
    const stored = JSON.parse(quiz.questions);
    const result = stored.some((q: any) => q.type && q.type !== 'mcq') || quiz.type === 'ADAPTIVE'
      ? await quizAgent.submitQuizAttempt(userId, quizId, answers)
      : await quizService.submitQuizAttempt(userId, quizId, answers);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to retrieve all previous quiz attempts.
 */
export const getHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to list attempt history.',
      });
      return;
    }

    const history = await quizService.getHistory(userId);

    res.status(200).json({
      status: 'success',
      data: {
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};
