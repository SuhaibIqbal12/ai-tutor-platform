import { prisma } from '../config/prisma';

export class LearningDnaService {
  /**
   * Recalculates and updates the student's Learning DNA metrics based on real-time database logs.
   */
  public static async recalculateDNA(userId: string): Promise<void> {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId }
      });

      if (!profile) return;

      // 1. Calculate Knowledge Gaps and Subject Mastery from TopicMastery
      const masteries = await prisma.topicMastery.findMany({
        where: { userId }
      });

      const weakTopics = masteries.filter(m => m.status === 'WEAK').map(m => m.topic);
      const strongTopics = masteries.filter(m => m.status === 'STRONG').map(m => m.topic);

      // 2. Compute Retention Rate based on Quiz Attempt scores
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      let retentionRate = profile.retentionRate || 75.0;
      let confidenceLevel = profile.confidenceLevel || 70.0;

      if (quizAttempts.length > 0) {
        const totalScorePercent = quizAttempts.reduce((sum, qa) => sum + (qa.score / qa.totalCount) * 100, 0);
        const avgScore = totalScorePercent / quizAttempts.length;

        // Retention rate correlates directly with quiz accuracy over time
        retentionRate = Math.round(0.7 * avgScore + 0.3 * (profile.retentionRate || 75.0));

        // Confidence level goes up with correct answers, down with failures
        const latestAttempt = quizAttempts[0];
        const latestPct = (latestAttempt.score / latestAttempt.totalCount) * 100;
        confidenceLevel = Math.round(0.8 * latestPct + 0.2 * (profile.confidenceLevel || 70.0));
      }

      // 3. Compute Study Consistency based on quiz dates in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo }
        }
      });

      // Consistency percentage is based on active days out of the last 7 days
      const uniqueDays = new Set(recentAttempts.map(r => new Date(r.createdAt).toDateString()));
      const studyConsistency = Math.round((uniqueDays.size / 7) * 100);

      // 4. Adapt student level dynamically
      let currentLevel = profile.currentLevel || 'Intermediate';
      if (quizAttempts.length >= 3) {
        const avgLatest = quizAttempts.slice(0, 3).reduce((sum, qa) => sum + (qa.score / qa.totalCount) * 100, 0) / 3;
        if (avgLatest >= 85.0 && profile.cgpa >= 7.5) {
          currentLevel = 'Advanced';
        } else if (avgLatest < 50.0) {
          currentLevel = 'Beginner';
        } else {
          currentLevel = 'Intermediate';
        }
      }

      // 5. Update UserProfile with recalculated DNA
      await prisma.userProfile.update({
        where: { userId },
        data: {
          currentLevel,
          knowledgeGaps: JSON.stringify(weakTopics),
          retentionRate: Math.max(10, Math.min(100, retentionRate)),
          studyConsistency: Math.max(10, Math.min(100, studyConsistency)),
          confidenceLevel: Math.max(10, Math.min(100, confidenceLevel))
        }
      });
      
      console.log(`[DNA Engine] Updated learning profile for user ${userId}. Level: ${currentLevel}, Retention: ${retentionRate}%, Consistency: ${studyConsistency}%`);
    } catch (error) {
      console.error('[DNA Engine Error] Failed to update DNA metrics:', error);
    }
  }
}
