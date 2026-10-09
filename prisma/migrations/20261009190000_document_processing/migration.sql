ALTER TABLE "Document" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'UPLOADED',
 ADD COLUMN "progress" TEXT, ADD COLUMN "error" TEXT, ADD COLUMN "inputHash" TEXT,
 ADD COLUMN "sourceUrl" TEXT, ADD COLUMN "pageCount" INTEGER,
 ADD COLUMN "warnings" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "DocumentChunk" ADD COLUMN "chunkIndex" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "pageNumber" INTEGER, ADD COLUMN "timestamp" DOUBLE PRECISION,
 ADD COLUMN "model" TEXT NOT NULL DEFAULT 'Xenova/all-MiniLM-L6-v2',
 ADD COLUMN "dimensions" INTEGER NOT NULL DEFAULT 384;
-- Existing material has no verified processing metadata. Preserve it for explicit re-indexing.
UPDATE "Document" SET "status" = 'NEEDS_REINDEX';
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");
CREATE UNIQUE INDEX "Document_userId_inputHash_key" ON "Document"("userId", "inputHash");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
