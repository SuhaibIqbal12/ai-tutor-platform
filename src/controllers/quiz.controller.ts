import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { QuizService } from '../services/quiz.service';

const quizService = new QuizService();

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

    const count = questionCount ? parseInt(questionCount, 10) : 5;
    const result = await quizService.generateQuiz(userId, topic, count);

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

    const result = await quizService.submitQuizAttempt(userId, quizId, answers);

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
