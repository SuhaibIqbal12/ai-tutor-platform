import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TutorService } from '../services/tutor.service';

const tutorService = new TutorService();

/**
 * Controller endpoint to handle user tutoring requests (non-streaming).
 */
export const askQuestion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { question, conversationId, ragMode, subject } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to consult the AI Tutor.',
      });
      return;
    }

    const { response, conversationId: activeConversationId } =
      await tutorService.getTutoringResponse(userId, question, conversationId, !!ragMode, subject ? String(subject) : undefined);

    res.status(200).json({
      status: 'success',
      data: {
        response,
        conversationId: activeConversationId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to handle user tutoring requests (streaming via SSE).
 */
export const askQuestionStream = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { question, conversationId, ragMode, subject } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to consult the AI Tutor.',
      });
      return;
    }

    if (!question || typeof question !== 'string') {
      res.status(400).json({
        status: 'fail',
        message: 'question query parameter is required.',
      });
      return;
    }

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const isRag = ragMode === 'true';
    const convId = conversationId ? String(conversationId) : undefined;
    const subjStr = subject ? String(subject) : undefined;

    const { stream, conversationId: activeId } = await tutorService.getTutoringResponseStream(
      userId,
      question,
      convId,
      isRag,
      subjStr
    );

    // Write initial meta message containing conversationId
    res.write(`data: ${JSON.stringify({ type: 'meta', conversationId: activeId })}\n\n`);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`);
    }

    // Indicate completion
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('SSE Controller Error:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || error })}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};
