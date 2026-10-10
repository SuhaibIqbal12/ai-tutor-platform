const { spawnSync } = require('node:child_process');
require('dotenv').config();

const databaseUrl = process.env.TUTOR_DATABASE_URL_UNPOOLED
  || process.env.TUTOR_DATABASE_URL
  || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Deployment requires DATABASE_URL or TUTOR_DATABASE_URL.');
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: databaseUrl };
for (const args of [
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  [process.env.npm_execpath, 'run', 'build'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error('Deployment stopped: migration or build failed.');
    process.exit(result.status || 1);
  }
}
