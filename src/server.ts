import app from './app';
import dotenv from 'dotenv';
import { aiProviderService } from './services/ai-provider.service';
import './workers/rag.worker';

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
