import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('your_')) {
    throw new AppError('Password authentication is unavailable. Configure JWT_SECRET with at least 32 random characters.', 503);
  }
  return secret;
}

export class AuthService {
  private session(user: { id: string; email: string | null; createdAt: Date }) {
    return { user, token: jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), {
      algorithm: 'HS256', issuer: 'ai-tutor', audience: 'ai-tutor', expiresIn: '24h',
    }) };
  }
  async register(email: string, password: string) {
    getJwtSecret();
    email = email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new AppError('Unable to register this account. Try signing in or use your existing identity provider.', 409);
    }
    const hash = await bcrypt.hash(password, 12);
    try {
      const user = await prisma.user.create({
        data: { email, password: hash }, select: { id: true, email: true, createdAt: true },
      });
      return this.session(user);
    } catch (error: any) {
      if (error.code === 'P2002') throw new AppError('Unable to register this account.', 409);
      throw error;
    }
  }
  async login(email: string, password: string) {
    getJwtSecret();
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.password || !/^\$2[aby]\$/.test(user.password) || !(await bcrypt.compare(password, user.password))) {
      throw new AppError('Incorrect email or password. Accounts created by the old test login need a verified recovery flow.', 401);
    }
    return this.session({ id: user.id, email: user.email, createdAt: user.createdAt });
  }
}
