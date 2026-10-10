import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TutorService } from '../services/tutor.service';
import { prisma } from '../config/prisma';
import { teachingMode } from '../services/teaching-policy';
import { AppError } from '../middleware/error.middleware';

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
    const { question, conversationId, ragMode, subject, documentId, explanationMode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to consult the AI Tutor.',
      });
      return;
    }

    const { response, conversationId: activeConversationId } =
      await tutorService.getTutoringResponse(userId, question, conversationId, !!ragMode, subject ? String(subject) : undefined, documentId ? String(documentId) : undefined, teachingMode(explanationMode));

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
    const { question, conversationId, ragMode, subject, documentId, explanationMode } = req.method === 'POST' ? req.body : req.query;
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

    const isRag = ragMode === 'true' || ragMode === true;
    const convId = conversationId ? String(conversationId) : undefined;
    const subjStr = subject ? String(subject) : undefined;

    const { stream, conversationId: activeId } = await tutorService.getTutoringResponseStream(
      userId,
      question,
      convId,
      isRag,
      subjStr,
      documentId ? String(documentId) : undefined, teachingMode(explanationMode)
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
    console.error('SSE Controller Error:');
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error instanceof AppError ? error.message : 'Tutor response unavailable. Please try again.' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: 'Tutor response unavailable. Please try again.'
      });
    }
  }
};

export const listConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const search = String(req.query.search || '').slice(0,200);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    if (cursor && !await prisma.conversation.findFirst({ where: { id: cursor, userId: req.user!.id } })) throw new AppError('Conversation not found.',404);
    const rows = await prisma.conversation.findMany({ where: { userId: req.user!.id, messages: { some: {} }, ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { subject: { contains: search, mode: 'insensitive' } }, { messages: { some: { content: { contains: search, mode: 'insensitive' } } } }] } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, title: true, subject: true, updatedAt: true, ragMode: true, documentId: true, explanationMode: true, _count: { select: { messages: true } } } });
    res.json({ status: 'success', data: { conversations: rows.slice(0,50), nextCursor: rows.length > 50 ? rows[49].id : null } });
  } catch (error) { next(error); }
};
export const getConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await prisma.conversation.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!conversation) throw new AppError('Conversation not found.',404);
    const before = req.query.before ? String(req.query.before) : undefined;
    if (before && !await prisma.message.findFirst({ where: { id: before, conversationId: conversation.id } })) throw new AppError('Message not found.',404);
    const rows = await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 101, ...(before ? { cursor: { id: before }, skip: 1 } : {}) });
    res.json({ status: 'success', data: { ...conversation, messages: rows.slice(0,100).reverse(), olderCursor: rows.length > 100 ? rows[99].id : null } });
  } catch (error) { next(error); }
};
