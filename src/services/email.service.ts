export class EmailService {
  /**
   * Simulates sending a security lockout notification email to the user.
   */
  public async sendLockoutNotification(email: string): Promise<void> {
    const resetLink = `http://localhost:3000/reset-password?email=${encodeURIComponent(email)}`;
    console.log(`
=========================================
[SMTP EMAIL SIMULATOR] Outbox Notification
To: ${email}
Subject: Security Alert: Your Account has been Locked
Body:
We detected 5 consecutive failed login attempts on your account. 
To protect your security, your account has been temporarily locked for 15 minutes.

If this was you, you can unlock your account or reset your password using the link below:
${resetLink}

If this was not you, please secure your credentials immediately.
=========================================
`);
  }
}

export const emailService = new EmailService();
