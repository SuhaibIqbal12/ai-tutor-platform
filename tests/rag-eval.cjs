const fs = require('node:fs');
const { startDatabase } = require('./database.cjs');
const dataset = [
  { question: 'When did the Lumen satellite launch?', page: 1, evidence: '14 March 2024', category: 'direct' },
  { question: 'How much energy can the Lumen battery store?', page: 1, evidence: '720 watt hours', category: 'paraphrase' },
  { question: 'Who is the Lumen project director?', page: 1, evidence: 'Mira Sen', category: 'name' },
  { question: 'What is the telemetry transmission interval?', page: 2, evidence: '30 seconds', category: 'number' },
  { question: 'Where is the ground station located?', page: 2, evidence: 'Jaipur', category: 'direct' },
  { question: 'What is the battery capacity and how long can it power telemetry?', pages: [1,2], category: 'multi-page' },
  { question: 'What is the admission fee for the Paris art museum?', absent: true, category: 'unrelated' },
  { question: 'What is the Lumen satellite insurance premium?', requiresGenerationReview: true, category: 'related absent' },
];
exports.dataset = dataset;
exports.runEvaluation = async function(prisma, RagService, processDocument) {
  const user = await prisma.user.create({ data: { email: 'evaluation@example.test' } });
  const doc = await prisma.document.create({ data: { userId: user.id, title: 'Lumen study notes', fileType: 'PDF' } });
  await processDocument(doc.id, user.id, { fileType: 'PDF', fileBufferBase64: fs.readFileSync(require('node:path').join(__dirname,'fixtures/learning.pdf')).toString('base64') });
  const service = new RagService();
  const results = [];
  for (const item of dataset) {
    const result = await service.retrieve(user.id, item.question, doc.id);
    const pass = item.requiresGenerationReview ? null : item.absent ? result.sources.length === 0 : item.pages ? item.pages.every(page => result.sources.some(s => s.pageNumber === page)) : result.sources.some(s => s.pageNumber === item.page && s.content.includes(item.evidence));
    results.push({ ...item, pass, sources: result.sources.map(s => ({ page: s.pageNumber, score: +s.similarity.toFixed(3), lexical: +s.lexicalScore.toFixed(3) })) });
  }
  return { doc, user, results };
};
if (require.main === module) (async () => {
  const db = await startDatabase();
  try {
    const { prisma } = require('../dist/config/prisma');
    const { RagService } = require('../dist/services/rag.service');
    const { processDocument } = require('../dist/rag/processing');
    const result = await exports.runEvaluation(prisma, RagService, processDocument);
    console.log(JSON.stringify(result.results, null, 2));
    if (result.results.some(r => r.pass === false)) process.exitCode = 1;
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
