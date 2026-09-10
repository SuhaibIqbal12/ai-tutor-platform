/**
 * Re-index Script: Clears and regenerates all document chunk embeddings using real Gemini API.
 * Run with: npx ts-node src/scripts/reindex-embeddings.ts
 *
 * This fixes documents that were indexed during MOCK_AI mode (garbage embeddings).
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function chunkText(text: string, chunkSize = 250, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + chunkSize);
    chunks.push(chunkWords.join(' '));
    if (i + chunkSize >= words.length) break;
    i += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 0);
}

let extractor: any = null;

async function getEmbedding(text: string): Promise<number[]> {
  const { pipeline } = require('@xenova/transformers');
  if (!extractor) {
    console.log('   ↳ Loading offline embedding model (Xenova/all-MiniLM-L6-v2)...');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function reindexDocument(doc: { id: string; title: string; content: string }) {
  console.log(`\n📄 Re-indexing: "${doc.title.substring(0, 60)}..." (${doc.id})`);

  // 1. Delete all existing chunks for this document
  const deleted = await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
  console.log(`   ↳ Deleted ${deleted.count} old chunks`);

  // 2. Re-chunk the document content
  const chunks = chunkText(doc.content);
  console.log(`   ↳ Created ${chunks.length} new chunks`);

  if (chunks.length === 0) {
    console.warn(`   ⚠️  No content to embed — skipping.`);
    return;
  }

  // 3. Generate real embeddings and save
  let successCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      const vector = await getEmbedding(chunks[i]);
      await prisma.documentChunk.create({
        data: {
          documentId: doc.id,
          content: chunks[i],
          embedding: JSON.stringify(vector),
        },
      });
      successCount++;
      if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
        process.stdout.write(`\r   ↳ Embedded ${i + 1}/${chunks.length} chunks...`);
      }
    } catch (err: any) {
      console.error(`\n   ❌ Failed to embed chunk ${i + 1}: ${err.message}`);
    }
  }
  console.log(`\n   ✅ Done! ${successCount}/${chunks.length} chunks embedded.`);
}

async function main() {
  console.log('=================================================');
  console.log('  🔄 RAG Re-indexing: Regenerating Embeddings');
  console.log('=================================================');
  console.log(`  Using GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ MISSING'}\n`);

  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }

  // Find all documents that have content
  const docs = await prisma.document.findMany({
    where: { content: { not: '' } },
    select: { id: true, title: true, content: true, userId: true }
  });

  // Filter out junk documents (localhost health checks, empty content)
  const validDocs = docs.filter(d =>
    d.content &&
    d.content.trim().length > 50 &&
    !d.title.includes('localhost') &&
    !d.title.includes('127.0.0.1')
  );

  console.log(`Found ${docs.length} total documents, ${validDocs.length} valid for re-indexing.`);
  console.log(`Skipping ${docs.length - validDocs.length} junk/empty documents.\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < validDocs.length; i++) {
    const doc = validDocs[i];
    console.log(`\n[${i + 1}/${validDocs.length}] Processing...`);
    try {
      await reindexDocument({ ...doc, content: doc.content || '' });
      totalSuccess++;
    } catch (err: any) {
      console.error(`  ❌ Failed to re-index document ${doc.id}: ${err.message}`);
      totalFailed++;
    }
  }

  console.log('\n=================================================');
  console.log(`  ✅ Re-indexing Complete!`);
  console.log(`  Success: ${totalSuccess} documents`);
  console.log(`  Failed:  ${totalFailed} documents`);
  console.log('=================================================\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
