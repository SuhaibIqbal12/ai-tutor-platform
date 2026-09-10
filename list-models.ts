import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json() as any;
    console.log('Available Models in v1beta:');
    if (data.models) {
      for (const m of data.models) {
        console.log(`- ${m.name} (${m.displayName}) - Supported Methods: ${JSON.stringify(m.supportedGenerationMethods)}`);
      }
    } else {
      console.log('No models key found in response:', data);
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
