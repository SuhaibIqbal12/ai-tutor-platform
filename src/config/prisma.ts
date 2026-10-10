import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

// A prefixed Vercel integration can coexist with an older DATABASE_URL.
const databaseUrl = process.env.TUTOR_DATABASE_URL || process.env.DATABASE_URL;
export const prisma = new PrismaClient(databaseUrl
  ? { datasources: { db: { url: databaseUrl } } }
  : undefined);
