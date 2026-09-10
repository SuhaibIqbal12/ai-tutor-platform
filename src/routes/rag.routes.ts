import { Router } from 'express';
import { uploadDocument, uploadDocumentFile, uploadDocumentUrl, getDocuments, getKnowledgeGraph, getDocumentProgress } from '../controllers/rag.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /api/rag/upload (text input)
router.post('/upload', authMiddleware as any, uploadDocument);

// POST /api/rag/upload-file (file input)
router.post('/upload-file', authMiddleware as any, upload.single('file'), uploadDocumentFile);

// POST /api/rag/upload-url (Web link / YouTube link scraping)
router.post('/upload-url', authMiddleware as any, uploadDocumentUrl);

// GET /api/rag/documents (Get source documents list)
router.get('/documents', authMiddleware as any, getDocuments);

// GET /api/rag/graph (Get aggregated knowledge graph)
router.get('/graph', authMiddleware as any, getKnowledgeGraph);

// GET /api/rag/progress/:documentId (Get document processing progress)
router.get('/progress/:documentId', authMiddleware as any, getDocumentProgress);

export default router;
