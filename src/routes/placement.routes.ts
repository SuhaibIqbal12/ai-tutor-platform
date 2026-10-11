import { moduleInputs, validateModule } from '../middleware/module-validation';
import multer from 'multer';
import { extract } from '../rag/extraction';
import { AppError } from '../middleware/error.middleware';
import { Router } from 'express';
import { analyzeResume, getResumeReview, chatMockInterview, getPracticeChallenge } from '../controllers/placement.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
router.post('/resume/upload', authMiddleware as any, resumeUpload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError('Choose a resume file.',400);
    const types: Record<string,string> = { pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', odt: 'ODT', txt: 'TXT' };
    const type = types[file.originalname.split('.').pop()?.toLowerCase() || ''];
    if (!type) throw new AppError('Choose PDF, DOCX, XLSX, ODT or TXT.',415);
    if (['DOCX','XLSX','ODT'].includes(type) && file.buffer.subarray(0,2).toString() !== 'PK') throw new AppError('Invalid Office document.',422);
    let extracted;
    try { extracted = await extract({ fileType: type, fileBufferBase64: file.buffer.toString('base64') }); }
    catch (error) { if (error instanceof AppError) throw error; throw new AppError('Unable to read this resume. Check that the file is valid and contains selectable text.',422); }
    req.body = { resumeText: extracted.segments.map(s => s.text).join('\n'), targetRole: req.body.targetRole?.trim() || 'Software Engineer' };
    next();
  } catch (error) { next(error); }
}, validateModule(moduleInputs.resume), analyzeResume);

// POST /api/placement/resume
router.get('/resume', authMiddleware as any, getResumeReview);
router.post('/resume', authMiddleware as any, validateModule(moduleInputs.resume), analyzeResume);

// POST /api/placement/interview
router.post('/interview', authMiddleware as any, validateModule(moduleInputs.interview), chatMockInterview);

// GET /api/placement/practice
router.get('/practice', authMiddleware as any, validateModule(moduleInputs.practice, 'query'), getPracticeChallenge);

export default router;
