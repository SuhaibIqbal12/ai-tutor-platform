import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
const label = z.string().trim().min(1).max(50000);
const list = z.array(label).max(200);
const score = z.number().finite().min(0).max(10);
export const moduleOutputs = {
  exercise: z.object({ title: label, description: label, starterCode: z.string(), testCases: z.array(z.object({ input: z.string(), expectedOutput: z.string() })).min(1).max(100), hints: list }),
  review: z.object({ isCorrect: z.boolean(), feedback: label, bugsFound: list, hints: list, optimizedSolution: z.string(), timeComplexity: label, spaceComplexity: label }),
  resume: z.object({ atsScore: z.number().int().min(0).max(100), feedback: label, improvements: list, skillsIdentified: list, missingKeywords: list }),
  interview: z.object({ interviewerMessage: label, feedback: z.string().optional(), endSession: z.boolean() }),
  scorecard: z.object({ overallScore: score, grade: label, overallComment: label, strengths: list, improvements: list, answerBreakdown: z.array(z.object({ question: label, answer: z.string(), score, comment: label })).max(100) }),
  practice: z.object({ title: label, question: label, options: z.array(label).max(10).default([]), correctAnswerIndex: z.number().int().min(-1).optional(), explanation: label, systemDesignRubric: list.default([]) }).refine(value => !value.options.length || (value.correctAnswerIndex !== undefined && value.correctAnswerIndex >= 0 && value.correctAnswerIndex < value.options.length), 'Invalid correct answer index'),
  career: z.object({ title: label, roadmapStages: z.array(z.object({ stageName: label, description: label, recommendedSkills: list })).min(1).max(50), weeklyGoals: list, monthlyGoals: list, skillGapAnalysis: z.array(z.object({ skill: label, importance: label, learningResourceSuggestion: label })).max(100) }),
  plan: z.object({ title: label, dailyPlan: z.array(z.object({ task: label, durationMinutes: z.number().int().min(1).max(960) })).min(1).max(100), weeklyPlan: z.array(z.object({ week: label, focus: label, tasks: list })).min(1).max(52), monthlyPlan: list }),
};
export function parseModuleOutput<T>(raw: string, schema: z.ZodType<T>): T {
  try {
    const unfenced = raw.trim().replace(/^```(?:json)?\s*\n?/, '').replace(/\s*```$/, '');
    return schema.parse(JSON.parse(unfenced));
  } catch {
    throw new AppError('The AI service returned an invalid response. Please retry.', 502);
  }
}
