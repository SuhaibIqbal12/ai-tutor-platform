import { genAI, GEMINI_MODEL } from '../config/gemini';
import { SchemaType } from '@google/generative-ai';
import { AppError } from '../middleware/error.middleware';

export class CareerAgent {
  /**
   * Generates a career roadmap and skill gap analysis for a student.
   */
  public async generateCareerPlan(studentProfile: {
    academicYear: string;
    branch: string;
    cgpa: number;
    strongSubjects: string[];
    weakSubjects: string[];
    learningPreferences: string[];
    careerInterests: string[];
    learningStyle?: string;
    currentLevel?: string;
    retentionRate?: number;
    studyConsistency?: number;
    confidenceLevel?: number;
    knowledgeGaps?: string[];
    codingGrowthScore?: number;
    learningVelocity?: number;
  }, existingSkills: string[]): Promise<any> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            roadmapStages: {
              type: SchemaType.ARRAY,
              description: 'Step-by-step milestones to land their dream job',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  stageName: { type: SchemaType.STRING },
                  description: { type: SchemaType.STRING },
                  recommendedSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ['stageName', 'description', 'recommendedSkills']
              }
            },
            weeklyGoals: {
              type: SchemaType.ARRAY,
              description: 'Concrete targets for the next 4 weeks',
              items: { type: SchemaType.STRING }
            },
            monthlyGoals: {
              type: SchemaType.ARRAY,
              description: 'Broad targets for the next 3 months',
              items: { type: SchemaType.STRING }
            },
            skillGapAnalysis: {
              type: SchemaType.ARRAY,
              description: 'Skills missing from their profile needed for their career interests',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  skill: { type: SchemaType.STRING },
                  importance: { type: SchemaType.STRING, description: 'High, Medium, Low' },
                  learningResourceSuggestion: { type: SchemaType.STRING }
                },
                required: ['skill', 'importance', 'learningResourceSuggestion']
              }
            }
          },
          required: ['title', 'roadmapStages', 'weeklyGoals', 'monthlyGoals', 'skillGapAnalysis']
        }
      }
    });

    const prompt = `Formulate a comprehensive, structured career coaching profile for a student:
- Academic Year: ${studentProfile.academicYear}
- Branch/Major: ${studentProfile.branch}
- CGPA: ${studentProfile.cgpa}
- Strong Areas: ${studentProfile.strongSubjects.join(', ')}
- Weak Areas: ${studentProfile.weakSubjects.join(', ')}
- Career Interests: ${studentProfile.careerInterests.join(', ')}
- Existing Declared Skills: ${existingSkills.join(', ')}
- Student Learning Level (DNA): ${studentProfile.currentLevel || 'Intermediate'}
- Learning Style Preference (DNA): ${studentProfile.learningStyle || 'Mixed'}
- Student Confidence Level: ${studentProfile.confidenceLevel || 70}%
- Retention Rate: ${studentProfile.retentionRate || 75}%
- Study Consistency: ${studentProfile.studyConsistency || 50}%
- Real-time Knowledge Gaps: ${(studentProfile.knowledgeGaps || []).join(', ')}
- Coding Growth Score: ${studentProfile.codingGrowthScore || 0}
- Learning Velocity: ${studentProfile.learningVelocity || 1.0}

Provide a custom career roadmap, direct skill gap assessment, and weekly/monthly targets to help them achieve their goals. Adapt the roadmap complexity to their Student Learning Level (${studentProfile.currentLevel || 'Intermediate'}) and Learning Style (${studentProfile.learningStyle || 'Mixed'}).
If their Coding Growth Score is high, suggest advanced technical projects or complex algorithmic interviews. If Learning Velocity is high, compress the roadmap timeline as they learn fast.`;

    try {
      const result = await model.generateContent(prompt);
      let text = result.response.text();
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(text);
    } catch (err: any) {
      console.error('Career Agent Plan Generation Error:', err);
      throw new AppError(`Failed to generate career path: ${err.message || err}`, 502);
    }
  }
}
