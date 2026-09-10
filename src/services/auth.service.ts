import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { redisClient } from '../config/redis';
import { emailService } from './email.service';

export class AuthService {
  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'super_secure_ai_tutor_jwt_secret_key_2026';
  }

  /**
   * Registers a new student account.
   */
  public async register(email: string, password: string) {
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    // Check if the email address is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Silently return success to prevent email enumeration
      console.log(`[AuthService.register] Registration attempt for existing email ${email}. Silently returning success.`);
      return {
        user: {
          id: existingUser.id,
          email: existingUser.email,
          createdAt: existingUser.createdAt,
        },
        token: 'registration_completed_check_email_to_login'
      };
    }

    // Securely hash the user's password using bcrypt with 12 rounds
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Persist new user in SQLite/PostgreSQL
    const newUser = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    // Generate JWT token for immediate login
    const token = jwt.sign({ id: newUser.id }, this.getJwtSecret(), {
      expiresIn: '24h',
    });

    return { user: newUser, token };
  }

  /**
   * Validates user credentials and generates a session token.
   */
  public async login(email: string, password: string) {
    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const lockoutKey = `login_lockout:${email}`;
    const failedAttemptsKey = `login_failed_attempts:${email}`;

    // 1. Check lockout status
    const isLocked = await redisClient.get(lockoutKey);
    if (isLocked === 'true') {
      // Locked out! Enforce progressive delay (assume 5 failed attempts = 16 seconds delay)
      console.log(`[AuthService] Login blocked: ${email} is currently locked out.`);
      await new Promise(resolve => setTimeout(resolve, 16000));
      throw new AppError('Incorrect email or password', 401);
    }

    // 2. Find user in the database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Helper to handle login failure: records failed attempt, runs progressive delay, sets lockout if N >= 5
    const handleLoginFailure = async () => {
      const currentAttempts = await redisClient.incr(failedAttemptsKey);
      await redisClient.expire(failedAttemptsKey, 24 * 60 * 60); // 24 hours expiry

      // Calculate progressive delay: 1s, 2s, 4s, 8s, 16s... up to max 16s
      const delayMs = Math.min(1000 * Math.pow(2, currentAttempts - 1), 16000);
      console.warn(`[AuthService] Failed login attempt #${currentAttempts} for ${email}. Delaying response by ${delayMs}ms.`);

      if (currentAttempts >= 5) {
        // Trigger 15-minute account lockout
        console.warn(`[AuthService] Account lockout triggered for ${email} for 15 minutes.`);
        await redisClient.set(lockoutKey, 'true', 'EX', 15 * 60);
        
        // Dispatch email notification with password reset/unlock link
        await emailService.sendLockoutNotification(email).catch(err => {
          console.error('[AuthService] Failed to send lockout notification email', err);
        });
      }

      // Introduce progressive delay to prevent brute-forcing
      await new Promise(resolve => setTimeout(resolve, delayMs));
      throw new AppError('Incorrect email or password', 401);
    };

    if (!user || !user.password) {
      await handleLoginFailure();
      return; // TypeScript safeguard
    }

    let isPasswordCorrect = false;
    let needsRehash = false;

    // Check if the stored password is a valid bcrypt hash
    const isBcrypt = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');

    if (isBcrypt) {
      // 3. Verify password hash matches using constant-time comparison
      isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (isPasswordCorrect) {
        // Parse the cost rounds from the bcrypt hash
        const roundsMatch = user.password.match(/^\$2[aby]\$(\d+)\$/);
        if (roundsMatch) {
          const rounds = parseInt(roundsMatch[1], 10);
          if (rounds < 12) {
            // Decent bcrypt hash but under our round limit threshold (12). Trigger dynamic upgrade.
            needsRehash = true;
            console.log(`[AuthService] Upgrading bcrypt rounds from ${rounds} to 12 for user ${email}`);
          }
        }
      }
    } else {
      // Legacy/weak hashing or plain-text migration check
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      const sha1Hash = crypto.createHash('sha1').update(password).digest('hex');

      const matchesPlainText = password === user.password;
      const matchesMd5 = md5Hash === user.password;
      const matchesSha1 = sha1Hash === user.password;

      if (matchesPlainText || matchesMd5 || matchesSha1) {
        isPasswordCorrect = true;
        needsRehash = true;
        console.log(`[AuthService] Migrating user ${email} from legacy/plain password storage to bcrypt (12 rounds).`);
      }
    }

    if (!isPasswordCorrect) {
      await handleLoginFailure();
      return; // TypeScript safeguard
    }

    // 4. Perform dynamic migration upgrade on successful login if flagged
    if (needsRehash) {
      const newSalt = await bcrypt.genSalt(12);
      const secureHash = await bcrypt.hash(password, newSalt);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: secureHash }
      });
    }

    // 5. Clear failed attempts on successful login
    await redisClient.del(failedAttemptsKey);

    // Sign session token
    const token = jwt.sign({ id: user.id }, this.getJwtSecret(), {
      expiresIn: '24h',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    };
  }
}
