import { genAI, GEMINI_MODEL } from '../config/gemini';
import { prisma } from '../config/prisma';
import { SchemaType } from '@google/generative-ai';

export class RevisionAgent {
  /**
   * Compiles the knowledge heatmap data (Green = Strong, Yellow = Moderate, Red = Weak).
   */
  public async getHeatmapData(userId: string): Promise<any> {
    const masteries = await prisma.topicMastery.findMany({
      where: { userId },
      orderBy: { lastTested: 'desc' }
    });

    const categories = {
      strong: masteries.filter(m => m.status === 'STRONG').map(m => m.topic),
      moderate: masteries.filter(m => m.status === 'MODERATE').map(m => m.topic),
      weak: masteries.filter(m => m.status === 'WEAK').map(m => m.topic)
    };

    return {
      totalTracked: masteries.length,
      categories,
      rawList: masteries.map(m => ({
        topic: m.topic,
        status: m.status,
        correctCount: m.correctCount,
        incorrectCount: m.incorrectCount,
        lastTested: m.lastTested
      }))
    };
  }

  /**
   * Generates a personalized topic reinforcement plan using Gemini.
   */
  public async generateRevisionPlan(userId: string): Promise<string> {
    const heatmap = await this.getHeatmapData(userId);
    
    if (heatmap.totalTracked === 0) {
      return "Start taking quizzes in the Tutoring Chat or Quizzes tab, and the Revision Agent will automatically compile your personalized study targets here!";
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const prompt = `You are a patient, encouraging AI Revision Agent. Analyze the student's current learning heatmap and generate a personalized reinforcement schedule.
    
=== KNOWLEDGE HEATMAP ===
- Weak Topics (Needs Red Urgent Attention): ${heatmap.categories.weak.join(', ') || 'None'}
- Moderate Topics (Yellow - Review Recommended): ${heatmap.categories.moderate.join(', ') || 'None'}
- Strong Topics (Green - Mastered): ${heatmap.categories.strong.join(', ') || 'None'}
=========================

Format your output into 4 concise sections:
1. **Urgent Reinforcements**: Concrete study goals for the weak subjects.
2. **Maintenance Topics**: Spaced repetition reminders for moderate topics.
3. **Smart Reminders**: Simple mnemonic associations or memory tricks to review key terms.
4. **Encouragement**: A short motivation note tailored to their current mastery ratio.

Use clear, clean academic formatting. Avoid markdown headings that are too deep. Keep it minimal and readable like a Notion document.`;

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.error('Revision Agent Plan Generation Error:', err);
      return `### Revision Recommendations\n- Focus on reviewing your identified weak topics: **${heatmap.categories.weak.join(', ') || 'None'}**\n- Keep practicing quizzes to build up your heatmap score!`;
    }
  }
}
