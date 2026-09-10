import { aiClient } from '../config/ai.provider';
import { prisma } from '../config/prisma';

export class AnalyticsAgent {
  /**
   * Compiles raw study metrics and generates a tutoring performance critique.
   * Returns safe default values if user data is sparse (new users on fresh DB).
   */
  public async getDashboardStats(userId: string): Promise<any> {
    // Gracefully fetch user data - if user not found, return defaults (new PG DB)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        quizAttempts: { orderBy: { createdAt: 'asc' } },
        masteries: true,
        documents: { select: { id: true } }
      }
    });

    // If user doesn't exist in Postgres yet (e.g., old SQLite token), return safe empty dashboard
    if (!user) {
      return this.getEmptyDashboard();
    }

    // 1. Compute study stats
    const totalQuizzesTaken = user.quizAttempts.length;
    let averageScore = 0;
    if (totalQuizzesTaken > 0) {
      const sum = user.quizAttempts.reduce((acc, curr) => acc + (curr.score / curr.totalCount) * 100, 0);
      averageScore = Math.round(sum / totalQuizzesTaken);
    }

    const topicsMastered = user.masteries.filter(m => m.status === 'STRONG').length;
    const documentsIndexed = user.documents.length;

    // Calculate a simple learning streak based on quiz attempts
    let learningStreak = 0;
    if (user.quizAttempts.length > 0) {
      const dates = user.quizAttempts.map(q => new Date(q.createdAt).toDateString());
      const uniqueDates = Array.from(new Set(dates));
      learningStreak = uniqueDates.length;
    }

    // 2. Format growth stats for UI charts
    const quizHistoryChart = user.quizAttempts.slice(-10).map((attempt, idx) => ({
      name: `Quiz ${idx + 1}`,
      score: Math.round((attempt.score / attempt.totalCount) * 100)
    }));

    const skillGrowthChart = user.masteries.map(m => {
      const total = m.correctCount + m.incorrectCount;
      const pct = total > 0 ? Math.round((m.correctCount / total) * 100) : 0;
      return { subject: m.topic, A: pct };
    }).slice(0, 6);

    // 3. Generate textual summary from AI Coach
    let feedbackSummary = "Welcome! Start by taking some quizzes and uploading study materials. Your personalized analytics will appear here.";
    if (user.quizAttempts.length > 0 || user.masteries.length > 0) {
      try {
        const prompt = `You are a supportive, data-driven AI Analytics Coach. Analyze the student's metrics and write a brief analysis of their progress.
- Total Quizzes Attempted: ${totalQuizzesTaken}
- Average Quiz Score: ${averageScore}%
- Topics Mastered (Strong): ${topicsMastered}
- Total Topics Tracked: ${user.masteries.length}
- Total Resources Uploaded: ${documentsIndexed}
- Active Study Days Streak: ${learningStreak} days

Provide a 3-sentence summary highlighting:
1. Their main academic strength according to these numbers.
2. An area that needs focus.
3. A tip to maintain their streak and study efficiently.`;
        const result = await aiClient.generateContent(prompt);
        feedbackSummary = result.response.text();
      } catch (err) {
        console.error('Analytics Agent Summary Error:', err);
        feedbackSummary = 'Great progress! Continue taking quizzes and reviewing your heatmap to optimize your study paths.';
      }
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const placement = await prisma.placementProfile.findUnique({ where: { userId } });

    return {
      streak: learningStreak,
      averageScore,
      masteredCount: topicsMastered,
      documentsCount: documentsIndexed,
      quizHistoryChart,
      skillGrowthChart,
      aiFeedback: feedbackSummary,
      dna: profile ? {
        learningStyle: profile.learningStyle || 'Mixed',
        currentLevel: profile.currentLevel || 'Intermediate',
        retentionRate: profile.retentionRate ?? 75.0,
        studyConsistency: profile.studyConsistency ?? 50.0,
        confidenceLevel: profile.confidenceLevel ?? 70.0,
        knowledgeGaps: JSON.parse(profile.knowledgeGaps || '[]'),
        codingGrowthScore: profile.codingGrowthScore || 0,
        learningVelocity: profile.learningVelocity || 1.0,
        placementReadiness: placement?.readinessScore || 0,
        xp: profile.xp || 0,
        level: profile.level || 1,
        currentStreak: profile.currentStreak || 0,
        longestStreak: profile.longestStreak || 0,
        learningCoins: profile.learningCoins || 0,
        badges: JSON.parse(profile.badges || '[]'),
      } : this.getDefaultDna()
    };
  }

  private getEmptyDashboard() {
    return {
      streak: 0,
      averageScore: 0,
      masteredCount: 0,
      documentsCount: 0,
      quizHistoryChart: [],
      skillGrowthChart: [],
      aiFeedback: "Welcome to Personalized AI Tutor! Your account is set up. Complete the onboarding to personalize your learning experience.",
      dna: this.getDefaultDna()
    };
  }

  private getDefaultDna() {
    return {
      learningStyle: 'Mixed',
      currentLevel: 'Intermediate',
      retentionRate: 75.0,
      studyConsistency: 50.0,
      confidenceLevel: 70.0,
      knowledgeGaps: [],
      codingGrowthScore: 0,
      learningVelocity: 1.0,
      placementReadiness: 0,
      xp: 0,
      level: 1,
      currentStreak: 0,
      longestStreak: 0,
      learningCoins: 0,
      badges: [],
    };
  }
}

