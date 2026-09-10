import app from './app';
import dotenv from 'dotenv';
import { aiProviderService } from './services/ai-provider.service';

// Only load the RAG background worker when Redis is available
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  import('./workers/rag.worker').catch(err => {
    console.warn('[Server] RAG Worker not loaded (Redis not available):', err.message);
  });
} else {
  console.warn('[Server] RAG Worker skipped — no REDIS_URL configured.');
}

// Ensure environment variables are loaded
dotenv.config();

// Verify API keys configurations on startup
aiProviderService.validateKeys();

const PORT = process.env.PORT || 3000;

// Start the Express HTTP listener
const server = app.listen(PORT, () => {
  console.log('=========================================');
  console.log(`   AI Tutor Backend is running!`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log('=========================================');
});

// Process-level exception handling for unexpected errors
process.on('uncaughtException', (err: Error) => {
  console.error('CRITICAL: Uncaught Exception detected! Server shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('CRITICAL: Unhandled Promise Rejection detected! Gracefully shutting down...');
  console.error(reason);
  server.close(() => {
    process.exit(1);
  });
});
