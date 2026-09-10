import { genAI, GEMINI_MODEL } from '../config/gemini';
import { prisma } from '../config/prisma';
import { SchemaType } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';

export class PlannerAgent {
  /**
   * Generates a custom daily, weekly, and monthly study plan.
   */
  public async generateStudyPlan(
    userId: string,
    examDate: string,
    availableHoursPerDay: number,
    academicGoal: string
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, masteries: true }
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const branch = user.profile?.branch || 'General Science';
    const weakSubjects = user.profile ? JSON.parse(user.profile.weakSubjects) : [];
    const dbWeakTopics = user.masteries.filter(m => m.status === 'WEAK').map(m => m.topic);
    
    // Combine profile-level weak subjects with real-time quiz weaknesses
    const allWeakTopics = Array.from(new Set([...weakSubjects, ...dbWeakTopics]));

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            dailyPlan: {
              type: SchemaType.ARRAY,
              description: 'Routine tasks to run daily',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  task: { type: SchemaType.STRING },
                  durationMinutes: { type: SchemaType.INTEGER }
                },
                required: ['task', 'durationMinutes']
              }
            },
            weeklyPlan: {
              type: SchemaType.ARRAY,
              description: 'Milestones for the next 4 weeks',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  week: { type: SchemaType.STRING, description: 'Week 1, Week 2, etc.' },
                  focus: { type: SchemaType.STRING },
                  tasks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ['week', 'focus', 'tasks']
              }
            },
            monthlyPlan: {
              type: SchemaType.ARRAY,
              description: 'Long-term goals for the next 3 months',
              items: { type: SchemaType.STRING }
            }
          },
          required: ['title', 'dailyPlan', 'weeklyPlan', 'monthlyPlan']
        }
      }
    });

    const prompt = `Develop a structured study plan for a student with these parameters:
- Student Major/Branch: ${branch}
- Academic CGPA / Performance: ${user.profile?.cgpa || 'Average'}
- Focus Areas needing help (Weak Topics): ${allWeakTopics.join(', ') || 'General review'}
- Target Exam Date: ${examDate}
- Study Hours Available Daily: ${availableHoursPerDay} hours
- Goal: ${academicGoal}

Generate realistic daily tasks, a 4-week calendar breakdown, and a 3-month long-term roadmap. Ensure tasks are concrete and highly actionable.`;

    try {
      const result = await model.generateContent(prompt);
      const planJson = JSON.parse(result.response.text());

      // Save plan in the database
      const plan = await prisma.studyPlan.create({
        data: {
          userId,
          title: planJson.title || 'Personalized Study Roadmap',
          dailyTasks: JSON.stringify(planJson.dailyPlan),
          weeklyTasks: JSON.stringify(planJson.weeklyPlan),
          monthlyTasks: JSON.stringify(planJson.monthlyPlan),
          examDate: new Date(examDate)
        }
      });

      return {
        planId: plan.id,
        ...planJson,
        examDate: plan.examDate
      };
    } catch (err: any) {
      console.error('Planner Agent Study Plan Generation Error:', err);
      throw new AppError(`Failed to generate study plan: ${err.message || err}`, 502);
    }
  }

  /**
   * Retrieves the current study plan.
   */
  public async getLatestPlan(userId: string): Promise<any> {
    const plan = await prisma.studyPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!plan) return null;

    return {
      planId: plan.id,
      title: plan.title,
      dailyPlan: JSON.parse(plan.dailyTasks),
      weeklyPlan: JSON.parse(plan.weeklyTasks),
      monthlyPlan: JSON.parse(plan.monthlyTasks),
      examDate: plan.examDate
    };
  }
}
