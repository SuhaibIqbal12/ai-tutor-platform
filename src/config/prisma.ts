import { PrismaClient } from '@prisma/client';

// Instantiate and export a singleton Prisma Client instance
export const prisma = new PrismaClient();
