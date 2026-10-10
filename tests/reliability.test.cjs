const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const { startDatabase } = require('./database.cjs');
let redisProcess;
let database, prisma, origin, listener, token, userId, otherUser, doc;
let RagService, TutorService, processDocument, provider;
async function request(url, options = {}) {
  const response = await fetch(origin + url, options);
  return { status: response.status, data: await response.json() };
}
const body = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
before(async () => {
  database = await startDatabase();
  if (process.env.TEST_REDIS_BIN) {
    redisProcess = require('node:child_process').spawn(process.env.TEST_REDIS_BIN, ['--port','16379','--bind','127.0.0.1','--save','','--appendonly','no'], { stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve,reject) => {
      const timeout = setTimeout(() => reject(new Error('Redis startup timed out')), 5000);
      redisProcess.stdout.on('data', data => { if (String(data).includes('Ready to accept connections')) { clearTimeout(timeout); resolve(); } });
      redisProcess.on('error', reject);
      redisProcess.on('exit', code => { clearTimeout(timeout); reject(new Error(`Redis exited with ${code}`)); });
    });
    process.env.TEST_REDIS_URL = 'redis://127.0.0.1:16379';
  }
  if (process.env.TEST_REDIS_URL) process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  // Verify the connected integration wins over a stale legacy URL.
  process.env.TUTOR_DATABASE_URL = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:1/stale';
  prisma = require('../dist/config/prisma').prisma;
  RagService = require('../dist/services/rag.service').RagService;
  TutorService = require('../dist/services/tutor.service').TutorService;
  processDocument = require('../dist/rag/processing').processDocument;
  provider = require('../dist/services/ai-provider.service').aiProviderService;
  const app = require('../dist/app').default;
  listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  origin = `http://127.0.0.1:${listener.address().port}`;
});
after(async () => {
  listener?.closeAllConnections(); await new Promise(resolve => listener?.close(resolve));
  const { ragQueue } = require('../dist/queues/rag.queue'); await ragQueue?.close();
  require('../dist/config/redis').redisClient.disconnect();
  await database?.close();
  redisProcess?.kill();
});
test('password authentication stores a hash, preserves punctuation, and rejects wrong passwords', async () => {
  const credentials = { email: 'student@example.test', password: 'S3cure!$(password)' };
  const registered = await request('/api/auth/register', body(credentials));
  assert.equal(registered.status, 201); token = registered.data.data.token; userId = registered.data.data.user.id;
  const stored = await prisma.user.findUnique({ where: { id: userId } });
  assert.notEqual(stored.password, credentials.password); assert.match(stored.password, /^\$2/);
  assert.equal((await request('/api/auth/login', body({ ...credentials, password: 'Wrong1234' }))).status, 401);
  assert.equal((await request('/api/auth/login', body(credentials))).status, 200);
  assert.equal((await request('/api/auth/register', body(credentials))).status, 409);
});
test('forged, expired and missing tokens cannot read profiles; unsigned webhook cannot delete accounts', async () => {
  assert.equal((await request('/api/auth/profile')).status, 401);
  const fake = jwt.sign({ sub: userId }, 'a-different-secret');
  assert.equal((await request('/api/auth/profile', { headers: { Authorization: `Bearer ${fake}` } })).status, 401);
  const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { issuer: 'ai-tutor', audience: 'ai-tutor', expiresIn: -1 });
  assert.equal((await request('/api/auth/profile', { headers: { Authorization: `Bearer ${expired}` } })).status, 401);
  process.env.SUPABASE_WEBHOOK_SECRET = 'test-only-webhook-secret';
  assert.equal((await request('/api/auth/webhook', body({ type: 'DELETE', id: userId }))).status, 401);
  assert.ok(await prisma.user.findUnique({ where: { id: userId } }));
  assert.equal((await request('/api/diagnostics/logs')).status, 401);
});
test('real PDF extraction preserves pages, indexes valid vectors, and tolerates absent optional enrichment', async () => {
  doc = await prisma.document.create({ data: { userId, title: 'Lumen source', fileType: 'PDF' } });
  await processDocument(doc.id, userId, { fileType: 'PDF', fileBufferBase64: fs.readFileSync(`${__dirname}/fixtures/learning.pdf`).toString('base64') });
  const stored = await prisma.document.findUnique({ where: { id: doc.id }, include: { chunks: true } });
  assert.equal(stored.status, 'READY'); assert.equal(stored.pageCount, 2); assert.ok(stored.chunks.length >= 2);
  assert.ok(JSON.parse(stored.warnings).length > 0);
  for (const chunk of stored.chunks) { assert.equal(JSON.parse(chunk.embedding).length, 384); assert.ok(chunk.pageNumber); }
  const progress = await request(`/api/rag/progress/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(progress.data.data.tutorReady, true);
  const count = stored.chunks.length;
  await processDocument(doc.id, userId, { fileType: 'PDF', fileBufferBase64: fs.readFileSync(`${__dirname}/fixtures/learning.pdf`).toString('base64') });
  assert.equal(await prisma.documentChunk.count({ where: { documentId: doc.id } }), count);
});
test('retrieval uses real query embeddings and isolates users and selected documents', async () => {
  otherUser = await prisma.user.create({ data: { email: 'other@example.test' } });
  const retrieval = await new RagService().retrieve(userId, 'What is the Lumen battery capacity?', doc.id);
  assert.ok(retrieval.sources.some(s => s.content.includes('720 watt hours') && s.pageNumber === 1));
  assert.equal((await new RagService().retrieve(otherUser.id, 'Lumen battery')).sources.length, 0);
  await assert.rejects(new RagService().retrieve(otherUser.id, 'Lumen battery', doc.id), /unavailable/);
  const second = await prisma.document.create({ data: { userId, title: 'A different document', fileType: 'TXT' } });
  await processDocument(second.id, userId, { fileType: 'TXT', content: 'The Zephyr ocean buoy measures salinity every fifteen minutes near Kochi.' });
  assert.equal((await new RagService().retrieve(userId, 'What is the Lumen battery capacity?', second.id)).sources.length, 0);
});
test('document-mode absent evidence refuses without invoking an LLM; provider failures do not become saved answers', async () => {
  const tutor = new TutorService();
  const answer = await tutor.getTutoringResponse(otherUser.id, 'What is the tuition fee?', undefined, true);
  assert.match(answer.response, /couldn't find evidence/);
  await assert.rejects(tutor.getTutoringResponse(userId, 'Explain loops', undefined, false), /configured|generate|unavailable/);
  assert.equal(await prisma.message.count({ where: { content: { contains: 'configuration error' } } }), 0);
});
test('grounding system instruction, actual source IDs, page references, and fake citation rejection (LLM stub)', async () => {
  const original = provider.getModel;
  let captured;
  provider.getModel = options => ({ generateContent: async prompt => {
    captured = { options, prompt }; return { response: { text: () => 'The battery capacity is 720 watt hours [Source #1].' } };
  } });
  try {
    const response = await new TutorService().getTutoringResponse(userId, 'What is the Lumen battery capacity?', undefined, true, 'General', doc.id);
    assert.match(response.response, /page 1/); assert.match(captured.options.systemInstruction, /untrusted data/); assert.match(captured.prompt, /720 watt hours/);
    const { withVerifiedReferences } = require('../dist/rag/grounding');
    assert.throws(() => withVerifiedReferences('Claim [Source #99]', [{ id: 1 }]), /unsupported/);
  } finally { provider.getModel = original; }
});
test('corrupt/empty content fails durably and invalid uploads are rejected', async () => {
  const empty = await prisma.document.create({ data: { userId, title: 'Empty', fileType: 'TXT' } });
  await assert.rejects(processDocument(empty.id, userId, { fileType: 'TXT', content: '   ' }));
  assert.equal((await prisma.document.findUnique({ where: { id: empty.id } })).status, 'FAILED');
  const data = new FormData(); data.append('file', new Blob(['not pdf'], { type: 'application/pdf' }), 'bad.pdf');
  assert.equal((await request('/api/rag/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data })).status, 422);
  const large = new FormData(); large.append('file', new Blob([new Uint8Array(10*1024*1024+1)]), 'large.txt');
  assert.equal((await request('/api/rag/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: large })).status, 413);
});
test('private URLs, command-like video IDs, malformed vectors and invalid chunking are rejected', async () => {
  const { validatePublicUrl, youtubeId, isPublicAddress } = require('../dist/rag/url');
  for (const value of ['http://127.0.0.1','http://169.254.169.254','file:///etc/passwd','https://example.com:8080']) await assert.rejects(validatePublicUrl(value));
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
  assert.throws(() => youtubeId(new URL('https://youtube.com/watch?v=hello;bad')));
  const { cosine } = require('../dist/rag/embedding'); assert.equal(cosine([1],[1]), 0);
  const { splitSegments } = require('../dist/rag/text'); assert.throws(() => splitSegments([{ text: 'hello' }], 5, 5));
});
test('legacy MCQ scores and ownership; adaptive written exact equivalence and provider failure (LLM stub)', async () => {
  const { QuizService } = require('../dist/services/quiz.service');
  const { QuizAgent } = require('../dist/agents/quiz.agent');
  const mcq = { type: 'mcq', question: 'Capacity?', options: ['720','1','2','3'], correctAnswerIndex: 0, explanation: 'The source says 720.' };
  const quiz = await prisma.quiz.create({ data: { userId, topic: 'Satellite', questions: JSON.stringify([mcq]) } });
  await assert.rejects(new QuizService().submitQuizAttempt(otherUser.id, quiz.id, [0]), /not found/);
  assert.equal((await new QuizService().submitQuizAttempt(userId, quiz.id, [0])).score, 1);
  const written = await prisma.quiz.create({ data: { userId, topic: 'Station', type: 'ADAPTIVE', questions: JSON.stringify([{ type: 'fitb', question: 'Ground station city?', correctAnswerText: 'Jaipur', explanation: 'Jaipur is stated.' }]) } });
  assert.equal((await new QuizAgent().submitQuizAttempt(userId, written.id, ['  JAIPUR. '])).score, 1);
  const before = await prisma.quizAttempt.count({ where: { quizId: written.id } });
  await assert.rejects(new QuizAgent().submitQuizAttempt(userId, written.id, ['some explanation']), /evaluation is unavailable/);
  assert.equal(await prisma.quizAttempt.count({ where: { quizId: written.id } }), before);
});
test('small retrieval evaluation: direct, paraphrase, number, multi-page, unrelated and related-absent', async () => {
  const { runEvaluation } = require('./rag-eval.cjs');
  const result = await runEvaluation(prisma, RagService, processDocument);
  assert.deepEqual(result.results.filter(r => r.pass === false), []);
});
test('readiness distinguishes liveness from missing provider configuration', async () => {
  assert.equal((await request('/health')).status, 200);
  const ready = await request('/ready'); assert.equal(ready.status, 503); assert.equal(ready.data.providerConnectivity, 'Not probed');
});
test('real upload → Redis queue → worker → database → retrieval; duplicates reuse the source', { skip: !process.env.TEST_REDIS_URL && !process.env.TEST_REDIS_BIN }, async () => {
  const { redisClient } = require('../dist/config/redis');
  if (redisClient.status !== 'ready') await new Promise((resolve,reject) => { redisClient.once('ready',resolve); redisClient.once('error',reject); });
  const worker = require('../dist/workers/rag.worker').ragWorker;
  try {
    const data = new FormData(); data.append('file', new Blob([fs.readFileSync(`${__dirname}/fixtures/learning.pdf`)], { type: 'application/pdf' }), 'queued.pdf');
    const uploaded = await request('/api/rag/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
    assert.equal(uploaded.status, 202);
    const id = uploaded.data.data.documentId;
    for (let attempt = 0; attempt < 60; attempt++) {
      const status = await prisma.document.findUnique({ where: { id } });
      if (status.status === 'READY') break;
      if (status.status === 'FAILED') assert.fail(status.error);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal((await prisma.document.findUnique({ where: { id } })).status, 'READY');
    const retrieved = await new RagService().retrieve(userId, 'What is the Lumen battery capacity?', id);
    assert.ok(retrieved.sources.some(s => s.content.includes('720 watt hours')));
    const again = new FormData(); again.append('file', new Blob([fs.readFileSync(`${__dirname}/fixtures/learning.pdf`)]), 'queued.pdf');
    const duplicate = await request('/api/rag/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: again });
    assert.equal(duplicate.data.data.documentId, id);
  } finally { await worker.close(); }
});
test('quiz generation schema rejects duplicates and invalid keys and hides adaptive solutions', () => {
  const { validateQuestions, publicQuestions } = require('../dist/rag/quiz-validation');
  const q = { type: 'mcq', question: 'Capacity?', options: ['720','1','2','3'], correctAnswerIndex: 0, explanation: 'Evidence says 720.' };
  validateQuestions([q], 1);
  assert.throws(() => validateQuestions([q, {...q}], 2), /Duplicate/);
  assert.throws(() => validateQuestions([{...q, correctAnswerIndex: 9}], 1), /Invalid answer/);
  assert.throws(() => validateQuestions([{...q, options: ['720','720','2','3']}], 1), /Invalid answer/);
  const visible = publicQuestions([q])[0];
  assert.equal(visible.correctAnswerIndex, undefined); assert.equal(visible.explanation, undefined);
});
test('inline PDF upload indexes without a queue worker, reuses duplicates and recovers stale attempts', async () => {
  process.env.RAG_PROCESSING_MODE = 'inline';
  try {
    const content = 'The Aurora laboratory opens at 09:15 in Jaipur and studies solar panels.';
    const options = { ...body({ title: 'Inline notes', content }), headers: { ...body({}).headers, Authorization: `Bearer ${token}` } };
    const uploaded = await request('/api/rag/upload', options);
    assert.equal(uploaded.status, 200); assert.equal(uploaded.data.data.stage, 'READY');
    const id = uploaded.data.data.documentId;
    assert.ok((await new RagService().retrieve(userId, 'When does Aurora laboratory open?', id)).sources.length);
    assert.equal((await request('/api/rag/upload', options)).data.data.documentId, id);
    await prisma.document.update({ where: { id }, data: { status: 'EMBEDDING', updatedAt: new Date(Date.now() - 7 * 60000) } });
    assert.equal((await request('/api/rag/upload', options)).data.data.stage, 'READY');
    const data = new FormData(); data.append('file', new Blob([fs.readFileSync(`${__dirname}/fixtures/learning.pdf`)], { type: 'application/pdf' }), 'inline.pdf');
    const pdf = await request('/api/rag/upload-file', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data });
    assert.equal(pdf.status, 200); assert.equal(pdf.data.data.stage, 'READY');
    const oversized = await request('/api/rag/upload', { ...options, body: JSON.stringify({ title:'Long notes', content:'solar energy '.repeat(30000) }) });
    assert.equal(oversized.status, 422); assert.match(oversized.data.message, /Split/);
  } finally { delete process.env.RAG_PROCESSING_MODE; }
});
test('safe provider errors distinguish quota, credentials and outage without leaking SDK messages', () => {
  const { providerFailure } = require('../dist/services/ai-provider.service');
  assert.equal(providerFailure({ status:429 }).statusCode, 429);
  assert.match(providerFailure({ status:429 }).message, /usage limit/);
  assert.equal(providerFailure({ status:403 }).statusCode, 503);
  assert.equal(providerFailure({ status:500 }).statusCode, 502);
  assert.ok(!providerFailure({ status:500, message:'secret=do-not-print' }).message.includes('do-not-print'));
});
