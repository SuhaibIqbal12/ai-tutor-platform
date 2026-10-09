/** Re-index only legacy documents from their retained extracted text. */
import 'dotenv/config';
import { prisma } from '../config/prisma';
import { processDocument } from '../rag/processing';
async function main() {
  const docs = await prisma.document.findMany({ where: { status: 'NEEDS_REINDEX' }, select: { id: true, userId: true, content: true } });
  let failed = 0;
  for (const doc of docs) {
    if (!doc.content?.trim()) {
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED', error: 'Original text is unavailable. Re-upload the original document.' } });
      failed++; continue;
    }
    try {
      await processDocument(doc.id, doc.userId, { fileType: 'TEXT', content: doc.content });
      console.log(`Reindexed document ${doc.id}`);
    } catch { failed++; console.error(`Reindex failed for document ${doc.id}`); }
  }
  console.log(`Reindex complete: ${docs.length - failed} succeeded; ${failed} failed.`);
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('Reindex failed. Check database and model access.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
