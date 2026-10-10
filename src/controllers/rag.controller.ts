import { Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/prisma';
import { requireRagQueue } from '../queues/rag.queue';
import { RagService } from '../services/rag.service';
import { AppError } from '../middleware/error.middleware';
import { validatePublicUrl, youtubeId } from '../rag/url';
import { inlineProcessing } from '../config/processing';
import { processDocument } from '../rag/processing';
const ragService = new RagService();
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
async function enqueue(req: AuthenticatedRequest, res: Response, input: Record<string, any>, inputHash: string) {
  const userId = req.user!.id;
  const inline = inlineProcessing();
  const queue = inline ? null : await requireRagQueue();
  let document = await prisma.document.findUnique({ where: { userId_inputHash: { userId, inputHash } } });
  const stale = document && inline && document.status !== 'READY' && Date.now() - document.updatedAt.getTime() > 6 * 60 * 1000;
  if (document && !stale && !['FAILED','NEEDS_REINDEX'].includes(document.status)) {
    res.status(document.status === 'READY' ? 200 : 202).json({ status: 'success', message: 'This source already exists.', data: { documentId: document.id, title: document.title, stage: document.status } });
    return;
  }
  if (!document) {
    try {
      document = await prisma.document.create({ data: { title: input.title, userId, fileType: input.fileType, inputHash, sourceUrl: input.url } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        document = await prisma.document.findUnique({ where: { userId_inputHash: { userId, inputHash } } });
        if (!document) throw error;
        res.status(202).json({ status: 'success', data: { documentId: document.id, title: document.title, stage: document.status } }); return;
      }
      throw error;
    }
  }
  if (inline) {
    // Compare-and-set prevents concurrent retries from indexing the same source twice.
    const claimed = await prisma.document.updateMany({ where: { id: document.id, updatedAt: document.updatedAt },
      data: { status: 'PROCESSING', error: null, progress: null } });
    if (!claimed.count) {
      res.status(202).json({ status: 'success', data: { documentId: document.id, title: document.title, stage: 'PROCESSING' } });
      return;
    }
    await processDocument(document.id, userId, input as any);
    res.status(200).json({ status: 'success', message: 'Material indexed and ready for questions.',
      data: { documentId: document.id, title: document.title, stage: 'READY' } });
    return;
  }
  // Job IDs are stable per document. Remove a completed/failed job before retrying it.
  const existingJob = await queue!.getJob(document.id);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'failed' || state === 'completed') await existingJob.remove();
    else { res.status(202).json({ status: 'success', data: { documentId: document.id, title: document.title, stage: document.status } }); return; }
  }
  await prisma.document.update({ where: { id: document.id }, data: { status: 'UPLOADED', error: null, progress: null } });
  try {
    await queue!.add('process-document', { ...input, userId, documentId: document.id }, { jobId: document.id,
      attempts: 2, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 100 });
  } catch {
    await prisma.document.update({ where: { id: document.id }, data: { status: 'FAILED', error: 'Unable to queue processing. Retry when Redis is available.' } });
    throw new AppError('Unable to queue indexing. Please retry.', 503);
  }
  res.status(202).json({ status: 'success', message: 'Upload accepted. Indexing has not completed yet.', data: { documentId: document.id, title: document.title, stage: 'UPLOADED' } });
}
export const uploadDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, content } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || typeof content !== 'string' || !content.trim() || content.length > 500000) throw new AppError('Provide a title (up to 200 characters) and nonempty text (up to 500,000 characters).', 400);
    await enqueue(req, res, { title: title.trim(), content, fileType: 'TXT' }, hash(content));
  } catch (error) { next(error); }
};
export const uploadDocumentFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) throw new AppError('Select a supported file.', 400);
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = { pdf: 'PDF', txt: 'TXT', md: 'TXT', docx: 'DOCX', pptx: 'PPTX', xlsx: 'XLSX', odt: 'ODT', png: 'IMAGE', jpg: 'IMAGE', jpeg: 'IMAGE', webp: 'IMAGE' };
    const fileType = types[ext || ''];
    if (!fileType) throw new AppError('Unsupported file type.', 415);
    if (fileType === 'PDF' && !file.buffer.subarray(0,1024).includes(Buffer.from('%PDF-'))) throw new AppError('This file is not a valid PDF.', 422);
    if (['DOCX','PPTX','XLSX','ODT'].includes(fileType) && file.buffer.subarray(0,2).toString() !== 'PK') throw new AppError('This file is not a valid Office document.', 422);
    if (fileType === 'IMAGE') {
      const valid = ext === 'png' ? file.buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ext === 'webp' ? file.buffer.subarray(0,4).toString() === 'RIFF' && file.buffer.subarray(8,12).toString() === 'WEBP' : file.buffer[0] === 255 && file.buffer[1] === 216;
      if (!valid) throw new AppError('Invalid image file.', 422);
    }
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    await enqueue(req, res, { title: file.originalname.slice(0,200), fileType, mimeType, fileBufferBase64: file.buffer.toString('base64') }, hash(file.buffer));
  } catch (error) { next(error); }
};
export const uploadDocumentUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (typeof req.body.url !== 'string' || req.body.url.length > 2000) throw new AppError('Provide a valid URL.', 400);
    const url = await validatePublicUrl(req.body.url);
    const id = youtubeId(url);
    const source = id ? `https://www.youtube.com/watch?v=${id}` : url.href;
    await enqueue(req, res, { url: source, title: source.slice(0,200), fileType: id ? 'YOUTUBE' : 'WEB' }, hash(source));
  } catch (error) { next(error); }
};
export const getDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.document.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, fileType: true, status: true, error: true, warnings: true, createdAt: true } });
    res.json({ status: 'success', data: { documents } });
  } catch (error) { next(error); }
};
export const getKnowledgeGraph = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { res.json({ status: 'success', data: await ragService.getUserKnowledgeGraph(req.user!.id) }); }
  catch (error) { next(error); }
};
export const getDocumentProgress = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({ where: { id: req.params.documentId, userId: req.user!.id } });
    if (!doc) throw new AppError('Document not found.', 404);
    const saved = doc.progress ? JSON.parse(doc.progress) : {};
    res.json({ status: 'success', data: { ...saved, documentId: doc.id, stage: doc.status,
      status: doc.status === 'READY' ? 'completed' : doc.status === 'FAILED' ? 'failed' : 'pending',
      tutorReady: doc.status === 'READY', error: doc.error, warnings: JSON.parse(doc.warnings) } });
  } catch (error) { next(error); }
};
export const getDocumentDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const doc = await prisma.document.findFirst({ where: { id: req.params.documentId, userId: req.user!.id },
      select: { id: true, title: true, status: true, pageCount: true, sourceUrl: true, knowledgeGraph: true, flashcards: true, mindMap: true, warnings: true } });
    if (!doc) throw new AppError('Document not found.', 404);
    res.json({ status: 'success', data: { ...doc, warnings: JSON.parse(doc.warnings), flashcards: doc.flashcards ? JSON.parse(doc.flashcards) : [], knowledgeGraph: doc.knowledgeGraph ? JSON.parse(doc.knowledgeGraph) : null } });
  } catch (error) { next(error); }
};
