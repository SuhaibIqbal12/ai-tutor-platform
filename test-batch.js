const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function test() {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
  try {
    const res = await model.batchEmbedContents({
      requests: [
        { content: { role: 'user', parts: [{ text: 'hello' }] } },
        { content: { role: 'user', parts: [{ text: 'world' }] } }
      ]
    });
    console.log('Batch success!', res.embeddings.length);
  } catch (e) {
    console.error('Batch error:', e.message);
  }
}
test();
