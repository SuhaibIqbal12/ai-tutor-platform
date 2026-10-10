const { test, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.EMBEDDING_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-only-placeholder';
const originalFetch = global.fetch;
const { embed, embedBatch, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = require('../dist/rag/embedding');
after(() => { global.fetch = originalFetch; });
test('hosted embeddings batch inputs, retain model metadata and normalize 768-dimensional vectors', async () => {
  global.fetch = async (url, options) => {
    assert.ok(url.endsWith('/gemini-embedding-001:batchEmbedContents'));
    const body = JSON.parse(options.body);
    assert.equal(body.requests.length, 2);
    for (const request of body.requests) {
      assert.equal(request.outputDimensionality, 768);
      assert.equal(request.taskType, 'RETRIEVAL_DOCUMENT');
    }
    return Response.json({ embeddings: body.requests.map(() => ({ values: Array(768).fill(2) })) });
  };
  const vectors = await embedBatch(['first document', 'second document']);
  assert.equal(EMBEDDING_MODEL, 'gemini-embedding-001'); assert.equal(EMBEDDING_DIMENSIONS, 768);
  assert.equal(vectors.length, 2);
  assert.ok(Math.abs(vectors[0].reduce((sum, x) => sum + x*x, 0) - 1) < 1e-8);
});
test('query embeddings use the query task; malformed output fails before indexing', async () => {
  global.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).requests[0].taskType, 'RETRIEVAL_QUERY');
    return Response.json({ embeddings: [{ values: [1, 2] }] });
  };
  await assert.rejects(embed('query', 'RETRIEVAL_QUERY'), /invalid vectors/);
  await assert.rejects(embedBatch(Array(33).fill('word')), /too large/);
});
test('embedding quota errors preserve an actionable status and never echo credentials', async () => {
  let attempts = 0;
  global.fetch = async () => { attempts++; return Response.json({ error: 'sensitive SDK detail' }, { status:429 }); };
  await assert.rejects(embed('quota test'), error => error.statusCode === 429 && !error.message.includes('sensitive SDK detail'));
  assert.equal(attempts, 1);
});
