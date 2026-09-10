const { pipeline } = require('@xenova/transformers');

async function test() {
  console.log('Loading model...');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('Model loaded! Extracting...');
  const out = await extractor('Hello world', { pooling: 'mean', normalize: true });
  console.log('Success! Dimensions:', Array.from(out.data).length);
}
test().catch(console.error);
