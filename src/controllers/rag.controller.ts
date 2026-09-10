import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';
import { ragQueue } from '../queues/rag.queue';
import { RagService } from '../services/rag.service';

const ragService = new RagService();

/**
 * Controller endpoint to upload custom study guide material (text).
 */
export const uploadDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to upload study material.',
      });
      return;
    }

    if (!title || !content) {
      res.status(400).json({
        status: 'fail',
        message: 'Title and content are required.',
      });
      return;
    }

    // 1. Create the Document record with status processing
    const document = await prisma.document.create({
      data: {
        title,
        userId,
        fileType: 'TXT',
      },
    });

    // 2. Queue the BullMQ job for processing
    await ragQueue.add('process-document', {
      documentId: document.id,
      userId,
      fileType: 'TXT',
      content,
      title,
    });

    res.status(202).json({
      status: 'success',
      message: 'Document upload accepted and queued for indexing.',
      data: {
        documentId: document.id,
        title: document.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to upload custom study guide files (PDFs, Images, Office files).
 */
export const uploadDocumentFile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const file = req.file;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to upload study files.',
      });
      return;
    }

    if (!file) {
      res.status(400).json({
        status: 'fail',
        message: 'No file was uploaded.',
      });
      return;
    }

    // Assign fileType based on MIME type / extension
    let fileType = 'PDF';
    if (file.mimetype === 'application/pdf') {
      fileType = 'PDF';
    } else if (file.mimetype.startsWith('image/')) {
      fileType = 'IMAGE';
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.originalname.endsWith('.docx')
    ) {
      fileType = 'DOCX';
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.originalname.endsWith('.pptx')
    ) {
      fileType = 'PPTX';
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.originalname.endsWith('.xlsx')
    ) {
      fileType = 'XLSX';
    } else {
      fileType = 'TXT';
    }

    // 1. Create the Document record
    const document = await prisma.document.create({
      data: {
        title: file.originalname,
        userId,
        fileType,
      },
    });

    // 2. Queue the BullMQ job with file buffer in base64 format
    await ragQueue.add('process-document', {
      documentId: document.id,
      userId,
      fileType,
      fileBufferBase64: file.buffer.toString('base64'),
      originalName: file.originalname,
      title: file.originalname,
    });

    res.status(202).json({
      status: 'success',
      message: 'File upload accepted and queued for indexing.',
      data: {
        documentId: document.id,
        title: document.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to upload web URLs and YouTube links for parsing.
 */
export const uploadDocumentUrl = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { url } = req.body;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to ingest URLs.',
      });
      return;
    }

    if (!url) {
      res.status(400).json({
        status: 'fail',
        message: 'No URL was provided.',
      });
      return;
    }

    const isYoutube = url.includes('youtube.com/') || url.includes('youtu.be/');
    const fileType = isYoutube ? 'YOUTUBE' : 'WEB';
    const title = isYoutube ? `YouTube: ${url}` : `Webpage: ${url}`;

    // 1. Create the Document record
    const document = await prisma.document.create({
      data: {
        title,
        userId,
        fileType,
      },
    });

    // 2. Queue the job
    await ragQueue.add('process-document', {
      documentId: document.id,
      userId,
      fileType,
      url,
      title,
    });

    res.status(202).json({
      status: 'success',
      message: 'URL upload accepted and queued for indexing.',
      data: {
        documentId: document.id,
        title: document.title,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to list all user documents.
 */
export const getDocuments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required to list study materials.',
      });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileType: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to retrieve the user's aggregated knowledge graph.
 */
export const getKnowledgeGraph = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required.',
      });
      return;
    }

    const graph = await ragService.getUserKnowledgeGraph(userId);

    res.status(200).json({
      status: 'success',
      data: graph,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller endpoint to retrieve the progress of a document indexing task.
 */
export const getDocumentProgress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required.',
      });
      return;
    }

    // Verify the document belongs to the requesting user
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { userId: true }
    });

    if (!doc || doc.userId !== userId) {
      res.status(404).json({
        status: 'fail',
        message: 'Document not found.',
      });
      return;
    }

    const progressKey = `doc_progress:${documentId}`;
    const progressData = await redisClient.get(progressKey);

    if (!progressData) {
      const fullDoc = await prisma.document.findUnique({
        where: { id: documentId }
      });
      if (fullDoc && fullDoc.knowledgeGraph) {
        res.status(200).json({
          status: 'success',
          data: {
            documentId,
            status: 'completed',
            textExtracted: true,
            chunksCreated: true,
            embeddingsGenerated: true,
            graphGenerated: true,
            flashcardsGenerated: true,
            tutorReady: true,
            error: null
          }
        });
        return;
      }
      res.status(200).json({
        status: 'success',
        data: {
          documentId,
          status: 'pending',
          textExtracted: false,
          tutorReady: false,
          error: null
        }
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: JSON.parse(progressData),
    });
  } catch (error) {
    next(error);
  }
};
