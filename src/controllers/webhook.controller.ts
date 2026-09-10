import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

/**
 * Controller endpoint to handle user creation and deletion webhooks from Supabase.
 */
export const supabaseWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, record, event, user } = req.body;
    
    // Extract ID, email, and operation type dynamically to support multiple webhook payload structures
    const id = record?.id || user?.id || req.body.id;
    const email = record?.email || user?.email || req.body.email;
    const opType = type || event || req.body.type;

    if (!id) {
      res.status(400).json({
        status: 'fail',
        message: 'Missing user ID in webhook payload.',
      });
      return;
    }

    console.log(`[Supabase Webhook] Received ${opType || 'INSERT'} event for user ${id}`);

    if (opType === 'DELETE') {
      // Delete user from local database
      await prisma.user.delete({
        where: { id }
      }).catch((err) => {
        console.warn(`[Supabase Webhook] User delete failed (probably already deleted):`, err.message);
      });

      res.status(200).json({
        status: 'success',
        message: 'User deleted successfully.',
      });
      return;
    }

    // Default to INSERT / UPDATE (Upsert user metadata)
    await prisma.user.upsert({
      where: { id },
      update: { email },
      create: {
        id,
        email,
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'User synchronized successfully.',
    });
  } catch (error) {
    console.error('[Supabase Webhook Error]', error);
    next(error);
  }
};
