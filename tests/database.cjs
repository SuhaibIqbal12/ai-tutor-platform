const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
exports.startDatabase = async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  for (const name of ['GEMINI_API_KEY','XAI_API_KEY','OPENAI_API_KEY','OPENROUTER_API_KEY','OLLAMA_BASE_URL','SUPABASE_URL','SUPABASE_ANON_KEY','REDIS_URL','REDIS_HOST','TUTOR_DATABASE_URL','TUTOR_DATABASE_URL_UNPOOLED']) delete process.env[name];
  const db = await PGlite.create();
  for (const folder of fs.readdirSync(path.join(__dirname,'../prisma/migrations')).sort()) {
    const file = path.join(__dirname,'../prisma/migrations',folder,'migration.sql');
    if (fs.existsSync(file)) await db.exec(fs.readFileSync(file,'utf8'));
  }
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55439 });
  await server.start();
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/postgres?schema=public&connection_limit=1';
  return { db, close: async () => { await require('../dist/config/prisma').prisma.$disconnect(); await server.stop(); await db.close(); } };
};
